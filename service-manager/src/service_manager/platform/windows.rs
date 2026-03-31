use crate::service_manager::error::{Result, ServiceError};
use crate::service_manager::platform::{create_command, PlatformProcessManager, ProcessInfo};
use crate::types::{ServiceConfig, LogLevel};
use async_trait::async_trait;
use std::process::Command as StdCommand;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

// Windows API constants
const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
const PROCESS_TERMINATE: u32 = 0x0001;
const PROCESS_QUERY_INFORMATION: u32 = 0x0400;
const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x00002000;
const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: i32 = 9;

/// Windows 作业对象，确保子进程随父进程终止
pub struct JobObject {
    handle: isize,
}

impl JobObject {
    pub fn new() -> Result<Self> {
        unsafe {
            let handle = windows_sys::Win32::System::JobObjects::CreateJobObjectW(
                std::ptr::null_mut(),
                std::ptr::null(),
            );

            if handle == 0 {
                return Err(ServiceError::PlatformError(
                    format!("Failed to create job object: {}", std::io::Error::last_os_error())
                ));
            }

            // 配置作业对象：当最后一个句柄关闭时终止所有进程
            let mut info: windows_sys::Win32::System::JobObjects::JOBOBJECT_EXTENDED_LIMIT_INFORMATION =
                std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            let result = windows_sys::Win32::System::JobObjects::SetInformationJobObject(
                handle,
                JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
                &info as *const _ as *const _,
                std::mem::size_of::<windows_sys::Win32::System::JobObjects::JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );

            if result == 0 {
                windows_sys::Win32::Foundation::CloseHandle(handle);
                return Err(ServiceError::PlatformError(
                    format!("Failed to set job object info: {}", std::io::Error::last_os_error())
                ));
            }

            Ok(JobObject { handle })
        }
    }

    pub fn assign_process(&self, process_handle: isize) -> Result<()> {
        unsafe {
            let result = windows_sys::Win32::System::JobObjects::AssignProcessToJobObject(
                self.handle,
                process_handle,
            );

            if result == 0 {
                return Err(ServiceError::PlatformError(
                    format!("Failed to assign process to job: {}", std::io::Error::last_os_error())
                ));
            }
            Ok(())
        }
    }
}

impl Drop for JobObject {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.handle);
        }
    }
}

unsafe impl Send for JobObject {}
unsafe impl Sync for JobObject {}

/// Windows 进程管理器
pub struct WindowsProcessManager {
    job: JobObject,
}

#[async_trait]
impl PlatformProcessManager for WindowsProcessManager {
    fn new() -> Result<Self> {
        Ok(WindowsProcessManager {
            job: JobObject::new()?,
        })
    }

    async fn spawn_service(&mut self, config: &ServiceConfig) -> Result<u32> {
        // 检查端口是否已被占用
        if super::is_port_in_use(config.port).await {
            if let Some(pid) = self.find_pid_by_port(config.port) {
                let process_name = self
                    .get_process_info(pid)
                    .map(|p| p.name)
                    .unwrap_or_else(|| "unknown".to_string());

                return Err(ServiceError::PortInUseBy {
                    port: config.port,
                    pid,
                    process_name,
                });
            }

            return Err(ServiceError::PortInUse(config.port));
        }

        let mut cmd = create_command(config);

        // Windows 特定：使用 CREATE_NEW_PROCESS_GROUP 标志
        cmd.creation_flags(CREATE_NEW_PROCESS_GROUP);

        let mut child = cmd.spawn()
            .map_err(|e| ServiceError::StartFailed(
                config.name.clone(),
                format!("Failed to spawn process: {}", e)
            ))?;

        // 将进程加入作业对象
        if let Some(raw_handle) = child.raw_handle() {
            self.job.assign_process(raw_handle as isize)?;
        }

        let pid = child.id()
            .ok_or_else(|| ServiceError::StartFailed(
                config.name.clone(),
                "Failed to get process ID".to_string()
            ))?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let service_name = config.name.clone();
        if let Some(stdout) = stdout {
            tokio::spawn(async move {
                let reader = tokio::io::BufReader::new(stdout);
                use tokio::io::AsyncBufReadExt;
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    // 过滤健康检查日志
                    if is_health_check_log(&line) {
                        continue;
                    }
                    // 解析日志级别
                    let level = extract_log_level(&line);
                    match level {
                        LogLevel::Error => tracing::error!("[{}] {}", service_name, line),
                        LogLevel::Warn => tracing::warn!("[{}] {}", service_name, line),
                        LogLevel::Debug => tracing::debug!("[{}] {}", service_name, line),
                        LogLevel::Info => tracing::info!("[{}] {}", service_name, line),
                    }
                }
            });
        }

        let service_name = config.name.clone();
        if let Some(stderr) = stderr {
            tokio::spawn(async move {
                let reader = tokio::io::BufReader::new(stderr);
                use tokio::io::AsyncBufReadExt;
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    // 过滤健康检查日志
                    if is_health_check_log(&line) {
                        continue;
                    }
                    // 解析日志级别，而不是简单地标记为 error
                    let level = extract_log_level(&line);
                    match level {
                        LogLevel::Error => tracing::error!("[{}] {}", service_name, line),
                        LogLevel::Warn => tracing::warn!("[{}] {}", service_name, line),
                        LogLevel::Debug => tracing::debug!("[{}] {}", service_name, line),
                        LogLevel::Info => tracing::info!("[{}] {}", service_name, line),
                    }
                }
            });
        }

        Ok(pid)
    }

    async fn shutdown_process(&self, pid: u32, timeout_ms: u32) -> Result<()> {
        // 第 1 级：HTTP 优雅关闭（由调用方处理）
        // 第 2 级：发送优雅关闭信号（Ctrl+C 或 taskkill）
        // 第 3 级：强制终止

        // 首先检查进程是否还在运行
        if !self.is_process_running(pid) {
            tracing::debug!("Process {} is not running, no need to shutdown", pid);
            return Ok(());
        }

        // 尝试发送优雅关闭信号
        match send_graceful_shutdown(pid).await {
            Ok(()) => {
                tracing::debug!("Sent graceful shutdown signal to PID {}", pid);
                
                // 等待进程退出
                let wait_result = timeout(
                    Duration::from_millis(timeout_ms as u64),
                    wait_for_exit(pid)
                ).await;

                if wait_result.is_ok() {
                    tracing::debug!("Process {} exited gracefully", pid);
                    return Ok(());
                } else {
                    tracing::warn!("Process {} did not exit within timeout, forcing termination", pid);
                }
            }
            Err(e) => {
                tracing::warn!("Failed to send graceful shutdown to PID {}: {}", pid, e);
            }
        }

        // 强制终止作为最后手段
        if self.is_process_running(pid) {
            tracing::warn!("Force terminating process {}", pid);
            self.force_terminate(pid)?;
            
            // 短暂等待确认进程已终止
            tokio::time::sleep(Duration::from_millis(100)).await;
            
            if self.is_process_running(pid) {
                return Err(ServiceError::ProcessError(
                    format!("Failed to terminate process {} after force kill", pid)
                ));
            }
        }
        
        Ok(())
    }

    fn force_terminate(&self, pid: u32) -> Result<()> {
        unsafe {
            let handle = windows_sys::Win32::System::Threading::OpenProcess(
                PROCESS_TERMINATE,
                0,
                pid,
            );

            if handle == 0 {
                return Err(ServiceError::ProcessError(
                    format!("Failed to open process {}: {}", pid, std::io::Error::last_os_error())
                ));
            }

            let result = windows_sys::Win32::System::Threading::TerminateProcess(handle, 1);
            windows_sys::Win32::Foundation::CloseHandle(handle);

            if result == 0 {
                return Err(ServiceError::ProcessError(
                    format!("Failed to terminate process {}: {}", pid, std::io::Error::last_os_error())
                ));
            }

            Ok(())
        }
    }

    fn is_process_running(&self, pid: u32) -> bool {
        unsafe {
            let handle = windows_sys::Win32::System::Threading::OpenProcess(
                PROCESS_QUERY_INFORMATION,
                0,
                pid,
            );

            if handle == 0 {
                return false;
            }

            let mut exit_code: u32 = 0;
            let result = windows_sys::Win32::System::Threading::GetExitCodeProcess(
                handle,
                &mut exit_code,
            );
            windows_sys::Win32::Foundation::CloseHandle(handle);

            if result == 0 {
                return false;
            }

            // STILL_ACTIVE = 259
            exit_code == 259
        }
    }

    fn get_process_info(&self, pid: u32) -> Option<ProcessInfo> {
        unsafe {
            let handle = windows_sys::Win32::System::Threading::OpenProcess(
                PROCESS_QUERY_INFORMATION,
                0,
                pid,
            );

            if handle == 0 {
                return None;
            }

            // 获取进程名称
            let mut name_buffer = [0u16; 260];
            let name_len = windows_sys::Win32::System::ProcessStatus::GetModuleBaseNameW(
                handle,
                0,
                name_buffer.as_mut_ptr(),
                260,
            );

            windows_sys::Win32::Foundation::CloseHandle(handle);

            let name = if name_len > 0 {
                String::from_utf16_lossy(&name_buffer[..name_len as usize])
            } else {
                "unknown".to_string()
            };

            Some(ProcessInfo {
                pid,
                parent_pid: None,
                name,
                memory_usage: None,
                cpu_usage: None,
            })
        }
    }

    fn find_pid_by_port(&self, port: u16) -> Option<u32> {
        find_listening_pid_by_port(port)
    }
}

/// 查找指定端口范围内所有监听的进程 PID
pub fn find_pids_by_port_range(start_port: u16, end_port: u16) -> Vec<(u16, u32)> {
    let output = StdCommand::new("netstat")
        .args(["-ano", "-p", "tcp"])
        .output();

    let output = match output {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();
    let mut seen_pids = std::collections::HashSet::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() || !line.starts_with("TCP") {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 4 {
            continue;
        }

        let local_addr = parts.get(1).copied().unwrap_or_default();

        // 解析端口号
        let port = local_addr
            .rsplit(':')
            .next()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(0);

        if port < start_port || port > end_port {
            continue;
        }

        let (state, pid_str) = match parts.len() {
            4 => (None, parts[3]),
            _ => (Some(parts[3]), parts[4]),
        };

        if let Some(state) = state {
            let state_upper = state.to_ascii_uppercase();
            if !state_upper.contains("LISTEN") && !state_upper.contains("ESTABLISHED") {
                continue;
            }
        }

        if let Ok(pid) = pid_str.parse::<u32>() {
            if pid > 0 && !seen_pids.contains(&pid) {
                seen_pids.insert(pid);
                results.push((port, pid));
            }
        }
    }

    results
}

/// 强制终止指定 PID 的进程
pub fn force_kill_process(pid: u32) -> Result<()> {
    unsafe {
        let handle = windows_sys::Win32::System::Threading::OpenProcess(
            PROCESS_TERMINATE,
            0,
            pid,
        );

        if handle == 0 {
            return Err(ServiceError::ProcessError(
                format!("Failed to open process {}: {}", pid, std::io::Error::last_os_error())
            ));
        }

        let result = windows_sys::Win32::System::Threading::TerminateProcess(handle, 1);
        windows_sys::Win32::Foundation::CloseHandle(handle);

        if result == 0 {
            return Err(ServiceError::ProcessError(
                format!("Failed to terminate process {}: {}", pid, std::io::Error::last_os_error())
            ));
        }

        Ok(())
    }
}

/// 清理指定端口范围内的所有进程
pub fn cleanup_port_range(start_port: u16, end_port: u16) -> Vec<(u16, u32, bool)> {
    let pids = find_pids_by_port_range(start_port, end_port);
    let mut results = Vec::new();

    for (port, pid) in pids {
        let success = force_kill_process(pid).is_ok();
        results.push((port, pid, success));
    }

    results
}

fn find_listening_pid_by_port(port: u16) -> Option<u32> {
    let output = StdCommand::new("netstat")
        .args(["-ano", "-p", "tcp"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let port_suffix = format!(":{}", port);

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() || !line.starts_with("TCP") {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 4 {
            continue;
        }

        let local_addr = parts.get(1).copied().unwrap_or_default();
        if !local_addr.ends_with(&port_suffix) {
            continue;
        }

        let (state, pid_str) = match parts.len() {
            4 => (None, parts[3]),
            _ => (Some(parts[3]), parts[4]),
        };

        if let Some(state) = state {
            let state_upper = state.to_ascii_uppercase();
            if !state_upper.contains("LISTEN") {
                continue;
            }
        }

        if let Ok(pid) = pid_str.parse::<u32>() {
            if pid > 0 {
                return Some(pid);
            }
        }
    }

    None
}

/// 发送优雅关闭信号到进程
/// 首先尝试发送 Ctrl+C (GenerateConsoleCtrlEvent)，如果失败则尝试 taskkill /PID /T
async fn send_graceful_shutdown(pid: u32) -> Result<()> {
    // 方法1: 尝试使用 Windows API 发送 Ctrl+C 信号
    // 注意：GenerateConsoleCtrlEvent 只能发送到同一进程组的进程
    let result = unsafe {
        use windows_sys::Win32::System::Threading::OpenProcess;
        use windows_sys::Win32::System::Threading::PROCESS_CREATE_THREAD;
        use windows_sys::Win32::System::Threading::PROCESS_VM_OPERATION;
        use windows_sys::Win32::System::Threading::PROCESS_VM_WRITE;
        
        let handle = OpenProcess(
            PROCESS_CREATE_THREAD | PROCESS_VM_OPERATION | PROCESS_VM_WRITE,
            0,
            pid,
        );
        
        if handle != 0 {
            // 尝试附加到进程的控制台并发送 Ctrl+C
            // 使用 FreeConsole 和 AttachConsole 组合
            use windows_sys::Win32::System::Console::FreeConsole;
            use windows_sys::Win32::System::Console::AttachConsole;
            use windows_sys::Win32::System::Console::SetConsoleCtrlHandler;
            use windows_sys::Win32::System::Console::GenerateConsoleCtrlEvent;
            use windows_sys::Win32::System::Console::CTRL_C_EVENT;
            
            // 先释放当前控制台
            FreeConsole();
            
            // 附加到目标进程的控制台
            let attach_result = AttachConsole(pid);
            if attach_result != 0 {
                // 禁用 Ctrl+C 处理，这样信号会传递给进程
                SetConsoleCtrlHandler(None, 1);
                
                // 发送 Ctrl+C 信号
                let ctrl_result = GenerateConsoleCtrlEvent(CTRL_C_EVENT, 0);
                
                // 清理
                FreeConsole();
                
                if ctrl_result != 0 {
                    Ok(())
                } else {
                    Err(ServiceError::ProcessError(
                        format!("GenerateConsoleCtrlEvent failed: {}", std::io::Error::last_os_error())
                    ))
                }
            } else {
                Err(ServiceError::ProcessError(
                    format!("AttachConsole failed: {}", std::io::Error::last_os_error())
                ))
            }
        } else {
            Err(ServiceError::ProcessError(
                format!("OpenProcess failed: {}", std::io::Error::last_os_error())
            ))
        }
    };
    
    // 如果 API 方法失败，回退到 taskkill /PID /T（优雅终止）
    if result.is_err() {
        tracing::debug!("API shutdown failed for PID {}, falling back to taskkill", pid);
        
        let output = Command::new("taskkill")
            .args(&["/PID", &pid.to_string()])  // 不使用 /T，让子进程有机会自己处理
            .output()
            .await
            .map_err(|e| ServiceError::ProcessError(format!("Failed to execute taskkill: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // taskkill 返回 128 表示进程已经终止，这不是错误
            if !stderr.contains("已经终止") && !stderr.contains("already terminated") && !stderr.contains("128") {
                return Err(ServiceError::ProcessError(
                    format!("taskkill failed: {}", stderr)
                ));
            }
        }
    }
    
    Ok(())
}

/// 等待进程退出
async fn wait_for_exit(pid: u32) {
    loop {
        unsafe {
            let handle = windows_sys::Win32::System::Threading::OpenProcess(
                PROCESS_QUERY_INFORMATION,
                0,
                pid,
            );

            if handle == 0 {
                // 进程已退出
                return;
            }

            let mut exit_code: u32 = 0;
            let result = windows_sys::Win32::System::Threading::GetExitCodeProcess(
                handle,
                &mut exit_code,
            );
            windows_sys::Win32::Foundation::CloseHandle(handle);

            if result == 0 || exit_code != 259 {
                // 进程已退出
                return;
            }
        }

        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

/// 处理 Windows 路径
pub fn sanitize_windows_path(path: &str) -> String {
    // 处理 Windows 长路径问题 (MAX_PATH = 260)
    let path = if path.len() > 240 && !path.starts_with("\\\\?\\") {
        format!("\\\\?\\{}", path)
    } else {
        path.to_string()
    };

    // 处理空格路径：使用引号包裹
    if path.contains(' ') && !path.starts_with('"') {
        format!("\"{}\"", path)
    } else {
        path
    }
}

/// 检查日志行是否为健康检查请求（需要过滤掉）
/// 过滤掉 GET /health, GET /api/health 等成功的不重要信息
fn is_health_check_log(line: &str) -> bool {
    let line_lower = line.to_lowercase();
    
    // 过滤 Uvicorn 健康检查日志格式
    // 例如: 127.0.0.1:56697 - "GET /health HTTP/1.1" 200 OK
    if line_lower.contains("get /health") && line_lower.contains("200 ok") {
        return true;
    }
    if line_lower.contains("get /api/health") && line_lower.contains("200 ok") {
        return true;
    }
    
    false
}

/// 从日志行中提取日志级别
/// 支持多种格式：
/// - Uvicorn: "INFO:     message" 或 "ERROR:    message"
/// - 标准格式: "[INFO] message" 或 "[ERROR] message"
/// - 包含级别: 行中包含 ERROR/WARN/DEBUG/INFO 关键字
fn extract_log_level(line: &str) -> LogLevel {
    
    let trimmed = line.trim();
    let upper = trimmed.to_uppercase();
    
    // 检查 Uvicorn 格式: "INFO:", "ERROR:", "WARNING:", "DEBUG:"
    if upper.starts_with("ERROR:") {
        return LogLevel::Error;
    }
    if upper.starts_with("WARNING:") || upper.starts_with("WARN:") {
        return LogLevel::Warn;
    }
    if upper.starts_with("DEBUG:") {
        return LogLevel::Debug;
    }
    if upper.starts_with("INFO:") {
        return LogLevel::Info;
    }
    
    // 检查标准格式: "[ERROR]", "[WARN]", "[DEBUG]", "[INFO]"
    if upper.contains("[ERROR]") || upper.contains("[ERR]") {
        return LogLevel::Error;
    }
    if upper.contains("[WARN]") || upper.contains("[WRN]") {
        return LogLevel::Warn;
    }
    if upper.contains("[DEBUG]") || upper.contains("[DBG]") {
        return LogLevel::Debug;
    }
    if upper.contains("[INFO]") || upper.contains("[INF]") {
        return LogLevel::Info;
    }
    
    // 检查行中是否包含级别关键字（用于 Python logging 格式）
    // 格式: "2024-01-01 00:00:00 - module - INFO - message"
    if upper.contains(" - ERROR -") || upper.contains(" ERROR ") {
        return LogLevel::Error;
    }
    if upper.contains(" - WARNING -") || upper.contains(" - WARN -") || upper.contains(" WARN ") {
        return LogLevel::Warn;
    }
    if upper.contains(" - DEBUG -") || upper.contains(" DEBUG ") {
        return LogLevel::Debug;
    }
    if upper.contains(" - INFO -") || upper.contains(" INFO ") {
        return LogLevel::Info;
    }
    
    // 默认返回 Info 级别
    LogLevel::Info
}
