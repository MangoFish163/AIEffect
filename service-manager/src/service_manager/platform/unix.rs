use crate::service_manager::error::{ProcessError, ShutdownError, Result, ServiceError};
use crate::service_manager::platform::{create_command, PlatformProcessManager, ProcessInfo};
use crate::types::ServiceConfig;
use async_trait::async_trait;
use tokio::process::Command;
use tokio::signal::unix::{signal, SignalKind};
use tokio::time::{timeout, Duration};

/// Unix 进程管理器
pub struct UnixProcessManager;

#[async_trait]
impl PlatformProcessManager for UnixProcessManager {
    fn new() -> Result<Self> {
        Ok(UnixProcessManager)
    }

    async fn spawn_service(&mut self, config: &ServiceConfig) -> Result<u32> {
        // 检查端口是否已被占用
        if super::is_port_in_use(config.port).await {
            return Err(ServiceError::PortInUse(config.port));
        }

        let mut cmd = create_command(config);

        // Unix 特定：使用进程组
        cmd.process_group(0);

        let mut child = cmd.spawn()
            .map_err(|e| ServiceError::StartFailed(
                config.name.clone(),
                format!("Failed to spawn process: {}", e)
            ))?;

        let pid = child.id()
            .ok_or_else(|| ServiceError::StartFailed(
                config.name.clone(),
                "Failed to get process ID".to_string()
            ))?;

        // 启动日志收集任务
        let service_name = config.name.clone();
        tokio::spawn(async move {
            if let Some(stdout) = child.stdout.take() {
                let reader = tokio::io::BufReader::new(stdout);
                use tokio::io::AsyncBufReadExt;
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    tracing::info!("[{}] {}", service_name, line);
                }
            }
        });

        let service_name = config.name.clone();
        tokio::spawn(async move {
            if let Some(stderr) = child.stderr.take() {
                let reader = tokio::io::BufReader::new(stderr);
                use tokio::io::AsyncBufReadExt;
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    tracing::error!("[{}] {}", service_name, line);
                }
            }
        });

        Ok(pid)
    }

    async fn shutdown_process(&self, pid: u32, timeout_ms: u32) -> Result<()> {
        // Unix 平台使用 SIGTERM -> SIGKILL 的策略

        // 发送 SIGTERM
        if let Err(e) = send_signal(pid, libc::SIGTERM).await {
            tracing::warn!("Failed to send SIGTERM to PID {}: {}", pid, e);
        } else {
            // 等待进程退出
            let wait_result = timeout(
                Duration::from_millis(timeout_ms as u64 * 2 / 3),
                wait_for_exit(pid)
            ).await;

            if wait_result.is_ok() {
                return Ok(());
            }
        }

        // 发送 SIGKILL
        tracing::info!("Sending SIGKILL to PID {}", pid);
        self.force_terminate(pid)
    }

    fn force_terminate(&self, pid: u32) -> Result<()> {
        unsafe {
            let result = libc::kill(pid as i32, libc::SIGKILL);
            if result == 0 {
                Ok(())
            } else {
                Err(ServiceError::ProcessError(
                    format!("Failed to send SIGKILL to {}: {}", pid, std::io::Error::last_os_error())
                ))
            }
        }
    }

    fn is_process_running(&self, pid: u32) -> bool {
        unsafe {
            libc::kill(pid as i32, 0) == 0
        }
    }

    fn get_process_info(&self, pid: u32) -> Option<ProcessInfo> {
        // 读取 /proc/{pid}/stat
        let stat_path = format!("/proc/{}/stat", pid);
        let stat_content = std::fs::read_to_string(&stat_path).ok()?;

        // 解析进程名称
        let name_start = stat_content.find('(')?;
        let name_end = stat_content.rfind(')')?;
        let name = stat_content[name_start + 1..name_end].to_string();

        // 解析父进程 ID
        let after_name = &stat_content[name_end + 2..];
        let parts: Vec<&str> = after_name.split_whitespace().collect();
        let parent_pid = parts.get(1).and_then(|p| p.parse().ok());

        Some(ProcessInfo {
            pid,
            parent_pid,
            name,
            memory_usage: None,
            cpu_usage: None,
        })
    }
}

/// 发送信号到进程
async fn send_signal(pid: u32, signal: i32) -> Result<()> {
    unsafe {
        let result = libc::kill(pid as i32, signal);
        if result == 0 {
            Ok(())
        } else {
            Err(ServiceError::ProcessError(
                format!("Failed to send signal {} to {}: {}",
                    signal, pid, std::io::Error::last_os_error())
            ))
        }
    }
}

/// 等待进程退出
async fn wait_for_exit(pid: u32) {
    loop {
        unsafe {
            if libc::kill(pid as i32, 0) != 0 {
                // 进程已退出
                return;
            }
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}
