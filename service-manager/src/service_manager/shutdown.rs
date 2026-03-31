use crate::service_manager::error::{Result, ServiceError};
use crate::service_manager::platform::PlatformProcessManager;
use crate::types::ServiceConfig;
use reqwest::Client;
use std::time::Duration;
use tokio::time::{timeout, sleep};

/// 关闭管理器
pub struct ShutdownManager {
    client: Client,
}

impl ShutdownManager {
    /// 创建新的关闭管理器
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_default();

        Self { client }
    }

    /// 优雅关闭服务
    ///
    /// 三级关闭策略：
    /// 1. HTTP /shutdown 端点（首选）
    /// 2. 信号发送（备选）
    /// 3. 强制终止（最后手段）
    pub async fn graceful_shutdown(
        &self,
        config: &ServiceConfig,
        pid: u32,
        platform: &dyn PlatformProcessManager,
    ) -> Result<()> {
        let timeout_ms = (config.shutdown_timeout_secs * 1000) as u32;

        // 第 1 级：尝试 HTTP 关闭
        match self.http_shutdown(config, timeout_ms / 2).await {
            Ok(()) => {
                tracing::info!("Service {} shutdown gracefully via HTTP", config.name);
                // 等待进程退出
                if wait_for_process_exit(pid, timeout_ms / 2, platform).await {
                    return Ok(());
                }
            }
            Err(e) => {
                tracing::warn!(
                    "HTTP shutdown failed for {}: {}, falling back to signal",
                    config.name,
                    e
                );
            }
        }

        // 第 2 级：平台特定的关闭（信号或 Ctrl+C）
        match platform.shutdown_process(pid, timeout_ms / 2).await {
            Ok(()) => {
                tracing::info!("Service {} shutdown via signal", config.name);
                return Ok(());
            }
            Err(e) => {
                tracing::error!(
                    "Signal shutdown failed for {}: {}, forcing termination",
                    config.name,
                    e
                );
            }
        }

        // 第 3 级：强制终止
        tracing::warn!("Force terminating service {}", config.name);
        platform.force_terminate(pid)?;

        Ok(())
    }

    /// HTTP 关闭请求
    async fn http_shutdown(&self, config: &ServiceConfig, timeout_ms: u32) -> Result<()> {
        let url = config.shutdown_url();

        let result = timeout(
            Duration::from_millis(timeout_ms as u64),
            self.client.post(&url).send(),
        )
        .await;

        match result {
            Ok(Ok(response)) => {
                if response.status().is_success() {
                    Ok(())
                } else {
                    Err(ServiceError::ShutdownTimeout(format!(
                        "HTTP shutdown returned status {}",
                        response.status()
                    )))
                }
            }
            Ok(Err(e)) => Err(ServiceError::ShutdownTimeout(format!(
                "HTTP shutdown request failed: {}",
                e
            ))),
            Err(_) => Err(ServiceError::ShutdownTimeout(
                "HTTP shutdown timeout".to_string()
            )),
        }
    }
}

impl Default for ShutdownManager {
    fn default() -> Self {
        Self::new()
    }
}

/// 等待进程退出
async fn wait_for_process_exit(
    pid: u32,
    timeout_ms: u32,
    platform: &dyn PlatformProcessManager,
) -> bool {
    let start = std::time::Instant::now();
    let timeout = Duration::from_millis(timeout_ms as u64);

    while start.elapsed() < timeout {
        if !platform.is_process_running(pid) {
            return true;
        }
        sleep(Duration::from_millis(100)).await;
    }

    false
}

/// 批量关闭服务
pub async fn shutdown_all_services(
    services: &[(ServiceConfig, u32)],
    platform: &dyn PlatformProcessManager,
) -> Vec<(String, Result<()>)> {
    let shutdown_manager = ShutdownManager::new();
    let mut results = Vec::new();

    // 按提供的顺序关闭（调用方应提供反向依赖顺序）
    for (config, pid) in services {
        tracing::info!("Stopping service: {}", config.name);

        let result = shutdown_manager
            .graceful_shutdown(config, *pid, platform)
            .await;

        results.push((config.name.clone(), result));
    }

    results
}
