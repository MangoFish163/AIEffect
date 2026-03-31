use crate::types::ServiceConfig;
use crate::service_manager::error::Result;
use async_trait::async_trait;
use std::process::Stdio;
use tokio::process::Command;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;

// 导出端口清理功能
#[cfg(target_os = "windows")]
pub use windows::cleanup_port_range;

#[cfg(not(target_os = "windows"))]
mod unix;
#[cfg(not(target_os = "windows"))]
pub use unix::*;

/// 平台特定的进程管理 trait
#[async_trait]
pub trait PlatformProcessManager: Send + Sync {
    /// 创建新的平台进程管理器
    fn new() -> Result<Self> where Self: Sized;

    /// 启动服务进程
    async fn spawn_service(&mut self, config: &ServiceConfig) -> Result<u32>;

    /// 优雅关闭进程
    async fn shutdown_process(&self, pid: u32, timeout_ms: u32) -> Result<()>;

    /// 强制终止进程
    fn force_terminate(&self, pid: u32) -> Result<()>;

    /// 检查进程是否仍在运行
    fn is_process_running(&self, pid: u32) -> bool;

    /// 获取进程信息
    fn get_process_info(&self, pid: u32) -> Option<ProcessInfo>;

    /// 根据端口查找监听进程 PID（平台能力允许时）
    fn find_pid_by_port(&self, _port: u16) -> Option<u32> {
        None
    }
}

/// 进程信息
#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub name: String,
    pub memory_usage: Option<u64>,
    pub cpu_usage: Option<f32>,
}

/// 创建命令
pub fn create_command(config: &ServiceConfig) -> Command {
    let mut cmd = Command::new(&config.command);
    cmd.args(&config.args)
        .current_dir(&config.working_dir)
        .envs(&config.env_vars)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // 注意：不设置 kill_on_drop，让进程独立运行

    cmd
}

/// 检查端口是否被占用
pub async fn is_port_in_use(port: u16) -> bool {
    // 尝试连接该端口
    match tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port)).await {
        Ok(_) => true,  // 端口被占用
        Err(_) => false, // 端口可用
    }
}

/// 等待端口可用
pub async fn wait_for_port(port: u16, timeout_secs: u64) -> Result<()> {
    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(timeout_secs);

    while start.elapsed() < timeout {
        if is_port_in_use(port).await {
            return Ok(());
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    Err(crate::service_manager::error::ServiceError::StartupTimeout(
        format!("Port {} not available after {} seconds", port, timeout_secs)
    ))
}
