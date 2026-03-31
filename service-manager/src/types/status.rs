use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 服务状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServiceStatus {
    /// 等待依赖
    Pending,
    /// 启动中
    Starting,
    /// 运行中
    Running,
    /// 关闭中
    Stopping,
    /// 已停止
    Stopped,
    /// 失败
    Failed,
    /// 重启中
    Restarting,
}

impl ServiceStatus {
    /// 检查状态是否为活跃状态
    pub fn is_active(&self) -> bool {
        matches!(self, ServiceStatus::Running | ServiceStatus::Starting)
    }

    /// 检查状态是否已停止
    pub fn is_stopped(&self) -> bool {
        matches!(self, ServiceStatus::Stopped | ServiceStatus::Failed)
    }

    /// 检查是否可以启动
    pub fn can_start(&self) -> bool {
        matches!(self, ServiceStatus::Stopped | ServiceStatus::Failed | ServiceStatus::Pending)
    }

    /// 检查是否可以停止
    pub fn can_stop(&self) -> bool {
        matches!(self, ServiceStatus::Running | ServiceStatus::Starting)
    }

    /// 获取状态的中文描述
    pub fn description(&self) -> &'static str {
        match self {
            ServiceStatus::Pending => "等待依赖",
            ServiceStatus::Starting => "启动中",
            ServiceStatus::Running => "运行中",
            ServiceStatus::Stopping => "关闭中",
            ServiceStatus::Stopped => "已停止",
            ServiceStatus::Failed => "失败",
            ServiceStatus::Restarting => "重启中",
        }
    }
}

impl std::fmt::Display for ServiceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

/// 服务状态信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStatusInfo {
    /// 服务名称
    pub name: String,
    /// 当前状态
    pub status: ServiceStatus,
    /// 进程 ID
    pub pid: Option<u32>,
    /// 启动时间
    pub started_at: Option<DateTime<Utc>>,
    /// 最后更新时间
    pub updated_at: DateTime<Utc>,
    /// 重启次数
    pub restart_count: u32,
    /// 最后错误信息
    pub last_error: Option<String>,
    /// 健康检查状态
    pub health_status: HealthStatus,
    /// 端口号
    pub port: u16,
}

impl ServiceStatusInfo {
    pub fn new(name: impl Into<String>, port: u16) -> Self {
        let now = Utc::now();
        Self {
            name: name.into(),
            status: ServiceStatus::Pending,
            pid: None,
            started_at: None,
            updated_at: now,
            restart_count: 0,
            last_error: None,
            health_status: HealthStatus::Unknown,
            port,
        }
    }

    /// 更新状态
    pub fn update_status(&mut self, status: ServiceStatus) {
        self.status = status;
        self.updated_at = Utc::now();

        // 记录启动时间
        if matches!(status, ServiceStatus::Running) && self.started_at.is_none() {
            self.started_at = Some(self.updated_at);
        }

        // 清除错误信息当服务成功启动
        if matches!(status, ServiceStatus::Running) {
            self.last_error = None;
        }
    }

    /// 设置进程 ID
    pub fn set_pid(&mut self, pid: u32) {
        self.pid = Some(pid);
        self.updated_at = Utc::now();
    }

    /// 增加重启计数
    pub fn increment_restart(&mut self) {
        self.restart_count += 1;
        self.updated_at = Utc::now();
    }

    /// 设置错误信息
    pub fn set_error(&mut self, error: impl Into<String>) {
        self.last_error = Some(error.into());
        self.updated_at = Utc::now();
    }

    /// 更新健康状态
    pub fn update_health(&mut self, health: HealthStatus) {
        self.health_status = health;
        self.updated_at = Utc::now();
    }

    /// 获取运行时长
    pub fn uptime(&self) -> Option<chrono::Duration> {
        self.started_at.map(|start| Utc::now() - start)
    }

    /// 获取运行时长的人性化显示
    pub fn uptime_display(&self) -> String {
        match self.uptime() {
            Some(duration) => {
                let secs = duration.num_seconds();
                if secs < 60 {
                    format!("{}s", secs)
                } else if secs < 3600 {
                    format!("{}m {}s", secs / 60, secs % 60)
                } else if secs < 86400 {
                    format!("{}h {}m", secs / 3600, (secs % 3600) / 60)
                } else {
                    format!("{}d {}h", secs / 86400, (secs % 86400) / 3600)
                }
            }
            None => "-".to_string(),
        }
    }
}

/// 健康检查状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    /// 未知
    Unknown,
    /// 健康
    Healthy,
    /// 不健康
    Unhealthy,
    /// 检查中
    Checking,
}

impl HealthStatus {
    pub fn is_healthy(&self) -> bool {
        matches!(self, HealthStatus::Healthy)
    }
}

/// 系统整体状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    /// 所有服务状态
    pub services: Vec<ServiceStatusInfo>,
    /// 整体状态
    pub overall: OverallStatus,
    /// 系统启动时间
    pub system_started_at: DateTime<Utc>,
    /// 运行模式
    pub run_mode: super::RunMode,
}

/// 整体系统状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverallStatus {
    /// 初始化中
    Initializing,
    /// 运行中
    Running,
    /// 部分服务失败
    Degraded,
    /// 已停止
    Stopped,
    /// 错误
    Error,
}

impl OverallStatus {
    pub fn from_services(services: &[ServiceStatusInfo]) -> Self {
        let all_running = services.iter().all(|s| s.status == ServiceStatus::Running);
        let any_running = services.iter().any(|s| s.status == ServiceStatus::Running);
        let any_failed = services.iter().any(|s| s.status == ServiceStatus::Failed);

        if all_running {
            OverallStatus::Running
        } else if any_failed && any_running {
            OverallStatus::Degraded
        } else if any_failed {
            OverallStatus::Error
        } else if any_running {
            OverallStatus::Initializing
        } else {
            OverallStatus::Stopped
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            OverallStatus::Initializing => "初始化中",
            OverallStatus::Running => "运行中",
            OverallStatus::Degraded => "部分服务异常",
            OverallStatus::Stopped => "已停止",
            OverallStatus::Error => "错误",
        }
    }
}

/// 日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    /// 时间戳
    pub timestamp: DateTime<Utc>,
    /// 服务名称
    pub service: String,
    /// 日志级别
    pub level: super::LogLevel,
    /// 消息内容
    pub message: String,
    /// 来源
    pub source: Option<String>,
}

/// 日志查询参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogQuery {
    /// 指定服务
    pub services: Option<Vec<String>>,
    /// 最低日志级别
    pub level: Option<super::LogLevel>,
    /// 开始时间
    pub start_time: Option<DateTime<Utc>>,
    /// 结束时间
    pub end_time: Option<DateTime<Utc>>,
    /// 关键词搜索
    pub search: Option<String>,
    /// 限制数量
    pub limit: Option<usize>,
}

impl Default for LogQuery {
    fn default() -> Self {
        Self {
            services: None,
            level: Some(super::LogLevel::Info),
            start_time: None,
            end_time: None,
            search: None,
            limit: Some(100),
        }
    }
}
