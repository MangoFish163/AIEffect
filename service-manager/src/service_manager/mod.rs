pub mod dependency;
pub mod error;
pub mod health;
pub mod log_aggregator;
pub mod platform;
pub mod shutdown;

use crate::service_manager::dependency::DependencyResolver;
use crate::service_manager::error::{Result, ServiceError};
use crate::service_manager::health::HealthChecker;
use crate::service_manager::log_aggregator::LogAggregator;
use crate::service_manager::platform::{is_port_in_use, PlatformProcessManager, wait_for_port};
use crate::service_manager::shutdown::ShutdownManager;
use crate::types::{GlobalConfig, HealthStatus, OverallStatus, RestartPolicy, RunMode, ServiceConfig, ServiceStatus, ServiceStatusInfo};
use dashmap::DashMap;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tokio::time::{interval, Duration};
use tracing::{debug, error, info, warn};

/// 服务管理器
pub struct ServiceManager {
    /// 全局配置
    config: Arc<RwLock<GlobalConfig>>,
    /// 服务状态
    statuses: Arc<DashMap<String, ServiceStatusInfo>>,
    /// 运行中的进程 PID
    processes: Arc<DashMap<String, u32>>,
    /// 平台进程管理器
    platform: Arc<RwLock<Box<dyn PlatformProcessManager>>>,
    /// 健康检查器
    health_checker: HealthChecker,
    /// 关闭管理器
    shutdown_manager: ShutdownManager,
    /// 日志聚合器
    log_aggregator: Arc<LogAggregator>,
    /// 是否正在关闭
    shutting_down: Arc<RwLock<bool>>,
    /// 重启请求通道
    restart_sender: mpsc::UnboundedSender<String>,
    /// 重启接收通道（仅用于保持通道打开）
    _restart_receiver: Arc<RwLock<mpsc::UnboundedReceiver<String>>>,
}

impl ServiceManager {
    /// 创建新的服务管理器
    pub async fn new(project_root: impl Into<String>) -> Result<Self> {
        let project_root = project_root.into();
        let config = GlobalConfig::default_config(&project_root);

        // 初始化平台特定的进程管理器
        let platform: Box<dyn PlatformProcessManager> = {
            #[cfg(target_os = "windows")]
            {
                Box::new(crate::service_manager::platform::WindowsProcessManager::new()?)
            }

            #[cfg(not(target_os = "windows"))]
            {
                Box::new(crate::service_manager::platform::UnixProcessManager::new()?)
            }
        };

        // 初始化服务状态
        let statuses = Arc::new(DashMap::new());
        for service in &config.services {
            statuses.insert(
                service.name.clone(),
                ServiceStatusInfo::new(&service.name, service.port),
            );
        }

        // 创建重启通道
        let (restart_sender, restart_receiver) = mpsc::unbounded_channel();

        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            statuses,
            processes: Arc::new(DashMap::new()),
            platform: Arc::new(RwLock::new(platform)),
            health_checker: HealthChecker::new(5),
            shutdown_manager: ShutdownManager::new(),
            log_aggregator: Arc::new(LogAggregator::default()),
            shutting_down: Arc::new(RwLock::new(false)),
            restart_sender,
            _restart_receiver: Arc::new(RwLock::new(restart_receiver)),
        })
    }

    /// 获取服务配置
    pub async fn get_service_config(&self, name: &str) -> Option<ServiceConfig> {
        let config = self.config.read().await;
        config.services.iter().find(|s| s.name == name).cloned()
    }

    /// 获取服务状态
    pub fn get_service_status(&self, name: &str) -> Option<ServiceStatusInfo> {
        self.statuses.get(name).map(|s| s.clone())
    }

    /// 获取所有服务状态
    pub fn get_all_statuses(&self) -> Vec<ServiceStatusInfo> {
        self.statuses.iter().map(|s| s.clone()).collect()
    }

    /// 获取系统整体状态
    pub async fn get_system_status(&self) -> OverallStatus {
        let statuses: Vec<_> = self.statuses.iter().map(|s| s.clone()).collect();
        OverallStatus::from_services(&statuses)
    }

    /// 启动单个服务
    pub async fn start_service(&self, name: &str) -> Result<()> {
        // 检查是否正在关闭
        if *self.shutting_down.read().await {
            return Err(ServiceError::ServiceNotRunning(name.to_string()));
        }

        // 获取服务配置
        let config = self.get_service_config(name).await
            .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;

        // 检查服务状态
        {
            let status = self
                .statuses
                .get(name)
                .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;
            if status.status.is_active() {
                return Err(ServiceError::ServiceAlreadyRunning(name.to_string()));
            }
        }

        if is_port_in_use(config.port).await && self.health_checker.quick_check(&config).await {
            let platform = self.platform.read().await;
            if let Some(pid) = platform.find_pid_by_port(config.port) {
                let process_name = platform
                    .get_process_info(pid)
                    .map(|p| p.name)
                    .unwrap_or_else(|| "unknown".to_string());

                if process_name != "unknown" && process_name_matches_command(&process_name, &config.command) {
                    let mut status = self
                        .statuses
                        .get_mut(name)
                        .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;
                    status.set_pid(pid);
                    status.update_status(ServiceStatus::Running);
                    status.update_health(HealthStatus::Healthy);

                    self.processes.insert(name.to_string(), pid);

                    info!("Service {} is already running (PID: {}), adopted", name, pid);
                    return Ok(());
                }

                let mut status = self
                    .statuses
                    .get_mut(name)
                    .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;
                status.update_status(ServiceStatus::Failed);
                status.set_error(format!(
                    "Port {} already in use by PID {} ({})",
                    config.port, pid, process_name
                ));

                return Err(ServiceError::PortInUseBy {
                    port: config.port,
                    pid,
                    process_name,
                });
            }
        }

        // 检查依赖
        for dep in &config.depends_on {
            let dep_status = self.statuses.get(dep).ok_or_else(|| {
                ServiceError::ConfigError(format!(
                    "Service '{}' depends on unknown service '{}'",
                    name, dep
                ))
            })?;
            if dep_status.status != ServiceStatus::Running {
                return Err(ServiceError::DependencyNotReady(
                    name.to_string(),
                    dep.clone(),
                ));
            }
        }

        // 更新状态为启动中
        {
            let mut status = self
                .statuses
                .get_mut(name)
                .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;
            status.update_status(ServiceStatus::Starting);
        }

        info!("Starting service: {}", name);

        // 启动进程
        let pid = match {
            let mut platform = self.platform.write().await;
            platform.spawn_service(&config).await
        } {
            Ok(pid) => pid,
            Err(e) => {
                if let Some(mut status) = self.statuses.get_mut(name) {
                    status.update_status(ServiceStatus::Failed);
                    status.set_error(e.to_string());
                }
                error!("Failed to spawn service {}: {}", name, e);
                return Err(e);
            }
        };

        // 更新状态
        {
            let mut status = self
                .statuses
                .get_mut(name)
                .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;
            status.set_pid(pid);
        }

        self.processes.insert(name.to_string(), pid);

        // 等待端口可用
        match wait_for_port(config.port, config.startup_timeout_secs).await {
            Ok(()) => (),
            Err(e) => {
                // 启动失败，清理
                let platform = self.platform.read().await;
                let _ = platform.force_terminate(pid);
                self.processes.remove(name);

                let mut status = self
                    .statuses
                    .get_mut(name)
                    .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;
                status.update_status(ServiceStatus::Failed);
                status.set_error(e.to_string());

                error!("Port wait failed for service {}: {}", name, e);
                return Err(e);
            }
        }

        // 等待健康检查通过
        match self.health_checker.wait_for_healthy(&config, config.startup_timeout_secs).await {
            Ok(()) => {
                let mut status = self
                    .statuses
                    .get_mut(name)
                    .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;
                status.update_status(ServiceStatus::Running);
                status.update_health(HealthStatus::Healthy);

                info!("Service {} started successfully (PID: {})", name, pid);
                Ok(())
            }
            Err(e) => {
                // 健康检查失败，清理
                let platform = self.platform.read().await;
                let _ = platform.force_terminate(pid);
                self.processes.remove(name);

                let mut status = self
                    .statuses
                    .get_mut(name)
                    .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;
                status.update_status(ServiceStatus::Failed);
                status.set_error(e.to_string());

                error!("Health check failed for service {}: {}", name, e);
                Err(e)
            }
        }
    }

    /// 停止单个服务
    pub async fn stop_service(&self, name: &str) -> Result<()> {
        let config = self.get_service_config(name).await
            .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;

        let pid = if let Some(pid) = self.processes.get(name) {
            *pid
        } else {
            let platform = self.platform.read().await;
            let pid = platform
                .find_pid_by_port(config.port)
                .ok_or_else(|| ServiceError::ServiceNotRunning(name.to_string()))?;

            let process_name = platform
                .get_process_info(pid)
                .map(|p| p.name)
                .unwrap_or_else(|| "unknown".to_string());

            if process_name == "unknown" || !process_name_matches_command(&process_name, &config.command) {
                // 进程名不匹配，尝试强制终止
                warn!(
                    "Port {} is occupied by PID {} ({}), attempting force kill...",
                    config.port, pid, process_name
                );
                #[cfg(target_os = "windows")]
                {
                    use crate::service_manager::platform::force_kill_process;
                    match force_kill_process(pid) {
                        Ok(()) => {
                            info!("Force killed process PID {} on port {}", pid, config.port);
                            // 更新状态
                            if let Some(mut status) = self.statuses.get_mut(name) {
                                status.update_status(ServiceStatus::Stopped);
                                status.pid = None;
                            }
                            return Ok(());
                        }
                        Err(e) => {
                            return Err(ServiceError::StopFailed(
                                name.to_string(),
                                format!("Failed to kill process {}: {}", pid, e),
                            ));
                        }
                    }
                }
                #[cfg(not(target_os = "windows"))]
                {
                    // Unix 系统使用 kill -9
                    let _ = tokio::process::Command::new("kill")
                        .args(["-9", &pid.to_string()])
                        .output()
                        .await;
                    info!("Force killed process PID {} on port {}", pid, config.port);
                    if let Some(mut status) = self.statuses.get_mut(name) {
                        status.update_status(ServiceStatus::Stopped);
                        status.pid = None;
                    }
                    return Ok(());
                }
            }

            pid
        };

        // 更新状态
        {
            let mut status = self
                .statuses
                .get_mut(name)
                .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;
            status.update_status(ServiceStatus::Stopping);
        }

        info!("Stopping service: {} (PID: {})", name, pid);

        // 优雅关闭
        let platform = self.platform.read().await;
        match self.shutdown_manager.graceful_shutdown(&config, pid, &**platform).await {
            Ok(()) => {
                self.processes.remove(name);

                let mut status = self
                    .statuses
                    .get_mut(name)
                    .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;
                status.update_status(ServiceStatus::Stopped);
                status.pid = None;

                info!("Service {} stopped successfully", name);
                Ok(())
            }
            Err(e) => {
                let mut status = self
                    .statuses
                    .get_mut(name)
                    .ok_or_else(|| ServiceError::ServiceNotFound(name.to_string()))?;
                status.update_status(ServiceStatus::Failed);
                status.set_error(e.to_string());

                Err(e)
            }
        }
    }

    /// 启动所有服务（按依赖顺序）
    pub async fn start_all(&self) -> Result<Vec<(String, Result<()>)>> {
        let config = self.config.read().await;
        let order = DependencyResolver::resolve(&config.services)?;
        drop(config);

        let mut results = Vec::new();

        for name in order {
            // 同步启动，确保错误隔离
            let result = self.start_service(&name).await;
            results.push((name, result));
        }

        Ok(results)
    }

    /// 停止所有服务（按依赖逆序）
    pub async fn stop_all(&self) -> Result<Vec<(String, Result<()>)>> {
        let config = self.config.read().await;
        let order = DependencyResolver::get_shutdown_order(&config.services)?;
        drop(config);

        let mut results = Vec::new();
        let mut any_service_stopped = false;

        for name in order {
            let should_stop = if self.processes.contains_key(&name) {
                true
            } else if let Some(status) = self.statuses.get(&name) {
                status.status.can_stop()
            } else {
                false
            };

            let should_stop = if should_stop {
                true
            } else if let Some(svc) = self.get_service_config(&name).await {
                is_port_in_use(svc.port).await && self.health_checker.quick_check(&svc).await
            } else {
                false
            };

            if should_stop {
                let result = self.stop_service(&name).await;
                if result.is_ok() {
                    any_service_stopped = true;
                }
                results.push((name, result));
            }
        }

        // 如果没有成功停止任何服务，清理 8500-8505 端口范围内的所有进程
        if !any_service_stopped {
            info!("No managed services found to stop, cleaning up port range 8500-8505...");
            self.cleanup_orphaned_processes().await;
        }

        Ok(results)
    }

    /// 清理服务使用的端口范围内的孤立进程
    async fn cleanup_orphaned_processes(&self) {
        let config = self.config.read().await;
        let services = &config.services;
        let platform = self.platform.read().await;

        #[cfg(target_os = "windows")]
        {
            use crate::service_manager::platform::cleanup_port_range;

            let cleanup_results = cleanup_port_range(8500, 8505);

            if cleanup_results.is_empty() {
                info!("No processes found in port range 8500-8505");
            } else {
                for (port, pid, success) in cleanup_results {
                    if success {
                        let process_name = platform.get_process_info(pid).map(|p| p.name).unwrap_or_else(|| "unknown".to_string());
                        let mut is_managed_service = false;
                        
                        // 检查进程是否匹配任何服务的命令
                        for service in services {
                            if process_name_matches_command(&process_name, &service.command) {
                                is_managed_service = true;
                                break;
                            }
                        }
                        
                        if is_managed_service {
                            info!("Terminated orphaned managed process PID {} ({}), port {}", pid, process_name, port);
                        } else {
                            warn!("Skipped termination of non-managed process PID {} ({}), port {}", pid, process_name, port);
                        }
                    } else {
                        warn!("Failed to terminate process PID {} on port {}", pid, port);
                    }
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            // Unix 系统：使用 lsof 查找并终止进程
            for port in 8500..=8505 {
                if let Ok(output) = tokio::process::Command::new("lsof")
                    .args(["-ti", &format!("tcp:{}", port)])
                    .output()
                    .await
                {
                    if output.status.success() {
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        for pid_str in stdout.lines() {
                            if let Ok(pid) = pid_str.parse::<u32>() {
                                let process_name = platform.get_process_info(pid).map(|p| p.name).unwrap_or_else(|| "unknown".to_string());
                                let mut is_managed_service = false;
                                
                                // 检查进程是否匹配任何服务的命令
                                for service in services {
                                    if process_name_matches_command(&process_name, &service.command) {
                                        is_managed_service = true;
                                        break;
                                    }
                                }
                                
                                if is_managed_service {
                                    let _ = tokio::process::Command::new("kill")
                                        .args(["-9", &pid.to_string()])
                                        .output()
                                        .await;
                                    info!("Terminated orphaned managed process PID {} ({}), port {}", pid, process_name, port);
                                } else {
                                    warn!("Skipped termination of non-managed process PID {} ({}), port {}", pid, process_name, port);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 等待端口释放
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    /// 重启服务
    pub async fn restart_service(&self, name: &str) -> Result<()> {
        // 如果服务正在运行，先停止
        if self.processes.contains_key(name) {
            self.stop_service(name).await?;
        }

        // 等待一下确保端口释放
        tokio::time::sleep(Duration::from_millis(500)).await;

        // 启动服务
        self.start_service(name).await
    }

    /// 启动健康检查循环
    pub fn start_health_check_loop(&self) {
        let statuses = self.statuses.clone();
        let processes = self.processes.clone();
        // 健康检查超时8秒，给服务更多响应时间
        let health_checker = HealthChecker::new(8);
        let config = self.config.clone();
        let shutting_down = self.shutting_down.clone();
        let restart_sender = self.restart_sender.clone();

        tokio::spawn(async move {
            use chrono::Utc;
            // 健康检查间隔10秒，确保超时 < 间隔
            let mut interval = interval(Duration::from_secs(10));
            // 记录每个服务的健康检查成功次数和上次状态
            let mut health_check_counters: HashMap<String, (u32, HealthStatus)> = HashMap::new();
            const SUCCESS_LOG_INTERVAL: u32 = 50; // 每50次成功输出一次日志
            const INITIAL_GRACE_PERIOD_SECS: i64 = 30; // 服务启动后的宽限期（秒）

            loop {
                interval.tick().await;

                // 检查是否正在关闭
                if *shutting_down.read().await {
                    break;
                }

                let config = config.read().await;

                for service in &config.services {
                    let name = &service.name;

                    // 只检查正在运行的服务
                    if let Some(_pid) = processes.get(name) {
                        // 检查服务是否在宽限期内
                        let in_grace_period = if let Some(status) = statuses.get(name) {
                            if let Some(started_at) = status.started_at {
                                let elapsed = Utc::now().signed_duration_since(started_at);
                                elapsed.num_seconds() < INITIAL_GRACE_PERIOD_SECS
                            } else {
                                false
                            }
                        } else {
                            false
                        };

                        if in_grace_period {
                            // 在宽限期内，跳过健康检查
                            continue;
                        }

                        match health_checker.check(service).await {
                            Ok(health) => {
                                let mut status = match statuses.get_mut(name) {
                                    Some(status) => status,
                                    None => continue,
                                };
                                
                                // 获取上次状态
                                let (counter, last_health) = health_check_counters
                                    .get(name)
                                    .copied()
                                    .unwrap_or((0, HealthStatus::Unknown));
                                
                                // 更新健康状态
                                let prev_health = status.health_status;
                                status.update_health(health);

                                if health == HealthStatus::Unhealthy {
                                    // 不健康时立即输出警告
                                    warn!("Service {} is unhealthy", name);
                                    health_check_counters.insert(name.clone(), (0, health));

                                    // 根据重启策略决定是否重启
                                    if service.restart_policy == RestartPolicy::Always
                                        || (service.restart_policy == RestartPolicy::OnFailure
                                            && status.restart_count < service.max_restarts)
                                    {
                                        warn!("Restarting service {}", name);
                                        status.increment_restart();
                                        status.update_status(ServiceStatus::Restarting);
                                        
                                        // 发送重启请求
                                        let _ = restart_sender.send(name.clone());
                                    }
                                } else {
                                    // 健康时增加计数器
                                    let new_counter = counter + 1;
                                    
                                    // 状态从异常恢复时输出信息
                                    if prev_health == HealthStatus::Unhealthy {
                                        info!("Service {} is healthy again", name);
                                    }
                                    
                                    // 每 SUCCESS_LOG_INTERVAL 次成功输出一次汇总日志
                                    if new_counter >= SUCCESS_LOG_INTERVAL {
                                        debug!("Service {} health check passed {} times", name, new_counter);
                                        health_check_counters.insert(name.clone(), (0, health));
                                    } else {
                                        health_check_counters.insert(name.clone(), (new_counter, health));
                                    }
                                }
                            }
                            Err(e) => {
                                error!("Health check error for {}: {}", name, e);
                            }
                        }
                    }
                }
            }
        });
    }

    /// 关闭管理器
    pub async fn shutdown(&self) -> Result<()> {
        info!("Shutting down service manager...");

        // 设置关闭标志
        *self.shutting_down.write().await = true;

        // 停止所有服务
        let results = self.stop_all().await?;

        // 检查结果
        let failed: Vec<_> = results
            .iter()
            .filter(|(_, r)| r.is_err())
            .map(|(n, _)| n.clone())
            .collect();

        if !failed.is_empty() {
            warn!("Some services failed to stop: {:?}", failed);
        }

        info!("Service manager shutdown complete");
        Ok(())
    }

    /// 获取日志聚合器
    pub fn get_log_aggregator(&self) -> Arc<LogAggregator> {
        self.log_aggregator.clone()
    }

    /// 获取运行模式
    pub async fn get_run_mode(&self) -> RunMode {
        let config = self.config.read().await;
        config.run_mode
    }

    /// 启动重启处理循环
    pub fn start_restart_handler(&self) {
        let self_clone = Self {
            config: self.config.clone(),
            statuses: self.statuses.clone(),
            processes: self.processes.clone(),
            platform: self.platform.clone(),
            health_checker: self.health_checker.clone(),
            shutdown_manager: ShutdownManager::new(),
            log_aggregator: self.log_aggregator.clone(),
            shutting_down: self.shutting_down.clone(),
            restart_sender: self.restart_sender.clone(),
            _restart_receiver: self._restart_receiver.clone(),
        };

        tokio::spawn(async move {
            self_clone._restart_handler_loop().await;
        });
    }

    /// 重启处理循环（内部方法）
    async fn _restart_handler_loop(&self) {
        let mut receiver = self._restart_receiver.write().await;
        
        while let Some(name) = receiver.recv().await {
            // 检查是否正在关闭
            if *self.shutting_down.read().await {
                break;
            }

            info!("Processing restart request for service: {}", name);
            
            // 执行重启
            if let Err(e) = self.restart_service(&name).await {
                error!("Failed to restart service {}: {}", name, e);
            }
        }
    }
}

fn process_name_matches_command(process_name: &str, command: &str) -> bool {
    let process_name = process_name.trim_matches('"').to_ascii_lowercase();
    let command = command.trim_matches('"').to_ascii_lowercase();
    if command.is_empty() {
        return true;
    }

    let expected = Path::new(&command)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&command)
        .to_ascii_lowercase();

    process_name.contains(&expected)
}
