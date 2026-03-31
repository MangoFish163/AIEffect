use thiserror::Error;

/// 服务管理器错误类型
#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("服务未找到: {0}")]
    ServiceNotFound(String),

    #[error("服务已在运行: {0}")]
    ServiceAlreadyRunning(String),

    #[error("服务未运行: {0}")]
    ServiceNotRunning(String),

    #[error("启动服务失败: {0} - {1}")]
    StartFailed(String, String),

    #[error("停止服务失败: {0} - {1}")]
    StopFailed(String, String),

    #[error("健康检查失败: {0}")]
    HealthCheckFailed(String),

    #[error("依赖未就绪: {0} 依赖 {1}")]
    DependencyNotReady(String, String),

    #[error("循环依赖检测: {0}")]
    CircularDependency(String),

    #[error("端口已被占用: {0}")]
    PortInUse(u16),

    #[error("端口已被占用: {port} (PID: {pid}, 进程: {process_name})")]
    PortInUseBy {
        port: u16,
        pid: u32,
        process_name: String,
    },

    #[error("启动超时: {0}")]
    StartupTimeout(String),

    #[error("关闭超时: {0}")]
    ShutdownTimeout(String),

    #[error("进程错误: {0}")]
    ProcessError(String),

    #[error("IO 错误: {0}")]
    IoError(#[from] std::io::Error),

    #[error("HTTP 错误: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("序列化错误: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("配置错误: {0}")]
    ConfigError(String),

    #[error("平台错误: {0}")]
    PlatformError(String),

    #[error("未知错误: {0}")]
    Unknown(String),
}

/// 进程管理错误
#[derive(Error, Debug)]
pub enum ProcessError {
    #[error("进程未找到: PID {0}")]
    ProcessNotFound(u32),

    #[error("终止进程失败: PID {0}")]
    TerminateFailed(u32),

    #[error("发送信号失败: {0}")]
    SignalFailed(String),

    #[error("创建进程失败: {0}")]
    SpawnFailed(String),

    #[error("等待进程失败: {0}")]
    WaitFailed(String),
}

/// 关闭错误
#[derive(Error, Debug)]
pub enum ShutdownError {
    #[error("HTTP 关闭失败: {0}")]
    HttpShutdownFailed(String),

    #[error("信号发送失败: {0}")]
    SignalFailed(String),

    #[error("强制终止失败: PID {0}")]
    ForceTerminateFailed(u32),

    #[error("超时")]
    Timeout,
}

/// 健康检查错误
#[derive(Error, Debug)]
pub enum HealthCheckError {
    #[error("连接失败: {0}")]
    ConnectionFailed(String),

    #[error("响应错误: {0}")]
    ResponseError(String),

    #[error("超时")]
    Timeout,

    #[error("服务返回不健康状态")]
    Unhealthy,
}

/// 结果类型别名
pub type Result<T> = std::result::Result<T, ServiceError>;
