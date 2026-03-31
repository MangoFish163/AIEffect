use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 运行模式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunMode {
    /// 开发模式：使用 npm run dev，热重载，详细日志
    Development,
    /// 生产模式：使用打包后的静态文件，优化性能
    Production,
}

impl RunMode {
    pub fn is_dev(&self) -> bool {
        matches!(self, RunMode::Development)
    }

    pub fn is_prod(&self) -> bool {
        matches!(self, RunMode::Production)
    }

    /// 检测当前运行模式
    pub fn detect() -> Self {
        // 1. 检查环境变量
        if let Ok(mode) = std::env::var("AI_EFFECT_MODE") {
            match mode.to_lowercase().as_str() {
                "development" | "dev" => return RunMode::Development,
                "production" | "prod" => return RunMode::Production,
                _ => {}
            }
        }

        // 2. 检查是否存在 .development 标记文件
        if std::path::Path::new(".development").exists() {
            return RunMode::Development;
        }

        // 3. 检查是否是调试构建 (通过编译时标志)
        #[cfg(debug_assertions)]
        return RunMode::Development;

        #[cfg(not(debug_assertions))]
        return RunMode::Production;
    }
}

impl Default for RunMode {
    fn default() -> Self {
        RunMode::Development
    }
}

/// 重启策略
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RestartPolicy {
    /// 总是重启
    Always,
    /// 失败时重启
    OnFailure,
    /// 不重启
    Never,
}

impl Default for RestartPolicy {
    fn default() -> Self {
        RestartPolicy::OnFailure
    }
}

/// 日志级别
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl Default for LogLevel {
    fn default() -> Self {
        LogLevel::Info
    }
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }
}

/// 服务配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    /// 服务标识
    pub name: String,
    /// 启动命令
    pub command: String,
    /// 启动参数
    pub args: Vec<String>,
    /// 工作目录
    pub working_dir: String,
    /// 服务端口号
    pub port: u16,
    /// 健康检查路径
    pub health_endpoint: String,
    /// 关闭端点路径
    pub shutdown_endpoint: String,
    /// 启动超时（秒）
    #[serde(default = "default_startup_timeout")]
    pub startup_timeout_secs: u64,
    /// 关闭超时（秒）
    #[serde(default = "default_shutdown_timeout")]
    pub shutdown_timeout_secs: u64,
    /// 重启策略
    #[serde(default)]
    pub restart_policy: RestartPolicy,
    /// 依赖服务列表
    #[serde(default)]
    pub depends_on: Vec<String>,
    /// 环境变量
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    /// 运行模式
    #[serde(default)]
    pub run_mode: RunMode,
    /// 日志级别
    #[serde(default)]
    pub log_level: LogLevel,
    /// 最大重启次数
    #[serde(default = "default_max_restarts")]
    pub max_restarts: u32,
    /// 重启间隔（秒）
    #[serde(default = "default_restart_interval")]
    pub restart_interval_secs: u64,
}

fn default_startup_timeout() -> u64 {
    30
}

fn default_shutdown_timeout() -> u64 {
    10
}

fn default_max_restarts() -> u32 {
    5
}

fn default_restart_interval() -> u64 {
    5
}

impl ServiceConfig {
    /// 创建默认配置
    pub fn new(name: impl Into<String>, port: u16) -> Self {
        Self {
            name: name.into(),
            command: String::new(),
            args: Vec::new(),
            working_dir: String::new(),
            port,
            health_endpoint: "/health".to_string(),
            shutdown_endpoint: "/shutdown".to_string(),
            startup_timeout_secs: default_startup_timeout(),
            shutdown_timeout_secs: default_shutdown_timeout(),
            restart_policy: RestartPolicy::OnFailure,
            depends_on: Vec::new(),
            env_vars: HashMap::new(),
            run_mode: RunMode::Development,
            log_level: LogLevel::Info,
            max_restarts: default_max_restarts(),
            restart_interval_secs: default_restart_interval(),
        }
    }

    /// 设置命令
    pub fn with_command(mut self, command: impl Into<String>) -> Self {
        self.command = command.into();
        self
    }

    /// 添加参数
    pub fn with_args(mut self, args: Vec<String>) -> Self {
        self.args = args;
        self
    }

    /// 设置工作目录
    pub fn with_working_dir(mut self, dir: impl Into<String>) -> Self {
        self.working_dir = dir.into();
        self
    }

    /// 添加依赖
    pub fn with_dependency(mut self, dep: impl Into<String>) -> Self {
        self.depends_on.push(dep.into());
        self
    }

    /// 设置环境变量
    pub fn with_env_var(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env_vars.insert(key.into(), value.into());
        self
    }

    /// 设置运行模式
    pub fn with_run_mode(mut self, mode: RunMode) -> Self {
        self.run_mode = mode;
        self
    }

    /// 设置健康检查端点
    pub fn with_health_endpoint(mut self, endpoint: impl Into<String>) -> Self {
        self.health_endpoint = endpoint.into();
        self
    }

    /// 设置关闭端点
    pub fn with_shutdown_endpoint(mut self, endpoint: impl Into<String>) -> Self {
        self.shutdown_endpoint = endpoint.into();
        self
    }

    /// 获取健康检查 URL
    pub fn health_url(&self) -> String {
        format!("http://127.0.0.1:{}{}", self.port, self.health_endpoint)
    }

    /// 获取关闭端点 URL
    pub fn shutdown_url(&self) -> String {
        format!("http://127.0.0.1:{}{}", self.port, self.shutdown_endpoint)
    }
}

/// 全局配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalConfig {
    /// 项目根目录
    pub project_root: String,
    /// 运行模式
    #[serde(default)]
    pub run_mode: RunMode,
    /// 服务列表
    pub services: Vec<ServiceConfig>,
    /// 日志目录
    #[serde(default = "default_log_dir")]
    pub log_dir: String,
    /// 数据目录
    #[serde(default = "default_data_dir")]
    pub data_dir: String,
    /// 健康检查间隔（秒）
    #[serde(default = "default_health_check_interval")]
    pub health_check_interval_secs: u64,
    /// 前端配置
    pub frontend: FrontendConfig,
}

fn default_log_dir() -> String {
    "logs".to_string()
}

fn default_data_dir() -> String {
    "data".to_string()
}

fn default_health_check_interval() -> u64 {
    5
}

impl GlobalConfig {
    /// 加载默认配置
    pub fn default_config(project_root: impl Into<String>) -> Self {
        let project_root = project_root.into();
        let run_mode = RunMode::detect();

        let services = vec![
            Self::create_log_service_config(&project_root, run_mode),
            Self::create_api_gateway_config(&project_root, run_mode),
            Self::create_websocket_config(&project_root, run_mode),
        ];

        Self {
            project_root: project_root.clone(),
            run_mode,
            services,
            log_dir: format!("{}/logs", project_root),
            data_dir: format!("{}/data", project_root),
            health_check_interval_secs: 5,
            frontend: FrontendConfig::for_mode(run_mode, &project_root),
        }
    }

    /// 创建日志服务配置
    fn create_log_service_config(project_root: &str, run_mode: RunMode) -> ServiceConfig {
        let service_path = format!("{}/services/log", project_root);

        ServiceConfig::new("log-service", 8505)
            .with_command("python")
            .with_args(vec!["start.py".to_string()])
            .with_working_dir(service_path)
            .with_run_mode(run_mode)
    }

    /// 创建 API Gateway 配置
    fn create_api_gateway_config(project_root: &str, run_mode: RunMode) -> ServiceConfig {
        let service_path = format!("{}/services/api_gateway", project_root);

        ServiceConfig::new("api-gateway", 8501)
            .with_command("python")
            .with_args(vec!["start.py".to_string()])
            .with_working_dir(service_path)
            .with_dependency("log-service")
            .with_run_mode(run_mode)
            .with_health_endpoint("/api/health")
            .with_shutdown_endpoint("/api/shutdown")
    }

    /// 创建 WebSocket 服务配置
    fn create_websocket_config(project_root: &str, run_mode: RunMode) -> ServiceConfig {
        let service_path = format!("{}/services/websocket", project_root);

        ServiceConfig::new("websocket", 8502)
            .with_command("python")
            .with_args(vec!["start.py".to_string()])
            .with_working_dir(service_path)
            .with_dependency("api-gateway")
            .with_run_mode(run_mode)
    }
}

/// 前端配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendConfig {
    /// 是否启用前端
    pub enabled: bool,
    /// 启动命令
    pub command: String,
    /// 启动参数
    pub args: Vec<String>,
    /// 工作目录
    pub working_dir: String,
    /// 端口号
    pub port: u16,
    /// 是否为外部进程
    pub is_external: bool,
}

impl FrontendConfig {
    /// 根据运行模式创建前端配置
    pub fn for_mode(mode: RunMode, project_root: &str) -> Self {
        match mode {
            RunMode::Development => Self {
                enabled: true,
                command: "npm".to_string(),
                args: vec!["run".to_string(), "dev".to_string()],
                working_dir: format!("{}/frontend", project_root),
                port: 5173,
                is_external: true,
            },
            RunMode::Production => Self {
                enabled: false,
                command: String::new(),
                args: vec![],
                working_dir: String::new(),
                port: 0,
                is_external: false,
            },
        }
    }
}
