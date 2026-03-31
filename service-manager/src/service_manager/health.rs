use crate::service_manager::error::Result;
use crate::types::{HealthStatus, ServiceConfig};
use reqwest::Client;
use std::time::Duration;
use tokio::time::timeout;

/// 健康检查器
#[derive(Clone)]
pub struct HealthChecker {
    client: Client,
    timeout_secs: u64,
}

impl HealthChecker {
    /// 创建新的健康检查器
    pub fn new(timeout_secs: u64) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()
            .unwrap_or_default();

        Self {
            client,
            timeout_secs,
        }
    }

    /// 检查服务健康状态
    pub async fn check(&self, config: &ServiceConfig) -> Result<HealthStatus> {
        let url = config.health_url();

        let result = timeout(
            Duration::from_secs(self.timeout_secs),
            self.client.get(&url).send(),
        )
        .await;

        match result {
            Ok(Ok(response)) => {
                if response.status().is_success() {
                    // 尝试解析响应体检查状态
                    match response.json::<serde_json::Value>().await {
                        Ok(body) => {
                            // 检查响应中的 status 字段（支持两种格式）
                            let status = if let Some(status) = body.get("status") {
                                status.as_str().unwrap_or("unknown")
                            } else if let Some(data) = body.get("data") {
                                // 支持 BaseResponse 格式，status 在 data 内部
                                data.get("status").and_then(|s| s.as_str()).unwrap_or("unknown")
                            } else {
                                "unknown"
                            };
                            
                            if status == "healthy" || status == "ok" {
                                Ok(HealthStatus::Healthy)
                            } else {
                                Ok(HealthStatus::Unhealthy)
                            }
                        }
                        Err(_) => {
                            // 无法解析 JSON，但 HTTP 成功，认为是健康的
                            Ok(HealthStatus::Healthy)
                        }
                    }
                } else {
                    Ok(HealthStatus::Unhealthy)
                }
            }
            Ok(Err(e)) => {
                tracing::debug!("Health check request failed for {}: {}", config.name, e);
                Ok(HealthStatus::Unhealthy)
            }
            Err(_) => {
                tracing::debug!("Health check timeout for {}", config.name);
                Ok(HealthStatus::Unhealthy)
            }
        }
    }

    /// 快速检查服务是否可连接
    pub async fn quick_check(&self, config: &ServiceConfig) -> bool {
        let url = config.health_url();

        match timeout(
            Duration::from_secs(2),
            self.client.get(&url).send(),
        )
        .await
        {
            Ok(Ok(response)) => response.status().is_success(),
            _ => false,
        }
    }

    /// 等待服务健康
    pub async fn wait_for_healthy(
        &self,
        config: &ServiceConfig,
        timeout_secs: u64,
    ) -> Result<()> {
        let start = std::time::Instant::now();
        let timeout_duration = Duration::from_secs(timeout_secs);

        while start.elapsed() < timeout_duration {
            match self.check(config).await {
                Ok(HealthStatus::Healthy) => return Ok(()),
                _ => {
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
            }
        }

        Err(crate::service_manager::error::ServiceError::StartupTimeout(
            format!("Service {} not healthy after {} seconds", config.name, timeout_secs)
        ))
    }
}

impl Default for HealthChecker {
    fn default() -> Self {
        Self::new(5)
    }
}
