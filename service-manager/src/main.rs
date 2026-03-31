mod service_manager;
mod types;

use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::{error, info};

#[derive(Parser)]
#[command(name = "service-manager")]
#[command(about = "AIEffect Service Lifecycle Manager")]
#[command(version = "1.0.0")]
struct Cli {
    /// 项目根目录
    #[arg(short, long, default_value = ".")]
    project_root: PathBuf,

    /// 运行模式
    #[arg(short, long, value_enum)]
    mode: Option<RunModeArg>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Clone, Copy, Debug, clap::ValueEnum)]
enum RunModeArg {
    Development,
    Production,
}

impl From<RunModeArg> for types::RunMode {
    fn from(mode: RunModeArg) -> Self {
        match mode {
            RunModeArg::Development => types::RunMode::Development,
            RunModeArg::Production => types::RunMode::Production,
        }
    }
}

#[derive(Subcommand)]
enum Commands {
    /// 启动所有服务
    Start {
        /// 指定要启动的服务（默认启动所有）
        #[arg(short, long)]
        service: Option<Vec<String>>,
    },
    /// 停止服务
    Stop {
        /// 指定要停止的服务（默认停止所有）
        #[arg(short, long)]
        service: Option<Vec<String>>,
    },
    /// 重启服务
    Restart {
        /// 服务名称
        service: String,
    },
    /// 查看服务状态
    Status {
        /// 服务名称（不指定则显示所有）
        service: Option<String>,
    },
    /// 启动并监控所有服务（开发模式）
    Dev {
        /// 是否启动前端
        #[arg(short, long, default_value = "true")]
        frontend: bool,
    },
    /// 查看日志
    Logs {
        /// 服务名称
        #[arg(short, long)]
        service: Option<String>,
        /// 日志级别过滤
        #[arg(short, long)]
        level: Option<String>,
        /// 实时跟踪
        #[arg(short, long)]
        follow: bool,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 初始化日志
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env()
            .add_directive(tracing::Level::INFO.into()))
        .init();

    let cli = Cli::parse();

    // 获取绝对路径
    let project_root = if cli.project_root.is_absolute() {
        cli.project_root
    } else {
        std::env::current_dir()?.join(cli.project_root)
    };

    // 使用 dunce 库处理 Windows UNC 路径前缀
    let project_root = dunce::canonicalize(&project_root)
        .unwrap_or_else(|_| project_root.clone());

    info!("Project root: {}", project_root.display());

    // 创建服务管理器
    let manager = service_manager::ServiceManager::new(
        project_root.to_string_lossy().to_string()
    ).await?;

    // 启动健康检查循环
    manager.start_health_check_loop();
    
    // 启动重启处理循环
    manager.start_restart_handler();

    match cli.command {
        Commands::Start { service } => {
            if let Some(services) = service {
                // 启动指定服务
                for name in services {
                    match manager.start_service(&name).await {
                        Ok(()) => info!("Service {} started", name),
                        Err(e) => error!("Failed to start service {}: {}", name, e),
                    }
                }
            } else {
                // 启动所有服务
                let results = manager.start_all().await?;
                for (name, result) in results {
                    match result {
                        Ok(()) => info!("Service {} started", name),
                        Err(e) => error!("Failed to start service {}: {}", name, e),
                    }
                }
            }

            // 保持运行
            info!("Press Ctrl+C to stop all services");
            
            // 创建一个信号监听器，同时处理多种信号
            let signal_future = async {
                #[cfg(windows)]
                {
                    // 在 Windows 上同时监听 Ctrl+C 和 Ctrl+Break 信号
                    let mut ctrl_c = tokio::signal::windows::ctrl_c()
                        .expect("Failed to create Ctrl+C listener");
                    let mut ctrl_break = tokio::signal::windows::ctrl_break()
                        .expect("Failed to create Ctrl+Break listener");
                    
                    tokio::select! {
                        _ = ctrl_c.recv() => {
                            info!("Received Ctrl+C signal");
                        }
                        _ = ctrl_break.recv() => {
                            info!("Received Ctrl+Break signal");
                        }
                    }
                }
                
                #[cfg(not(windows))]
                {
                    // 在非 Windows 系统上只监听 Ctrl+C 信号
                    tokio::signal::ctrl_c().await
                        .expect("Failed to listen for Ctrl+C");
                    info!("Received Ctrl+C signal");
                }
            };
            
            // 等待信号，然后执行 shutdown
            signal_future.await;
            
            info!("Starting service shutdown...");
            manager.shutdown().await?;
        }

        Commands::Stop { service } => {
            if let Some(services) = service {
                // 停止指定服务
                for name in services {
                    match manager.stop_service(&name).await {
                        Ok(()) => info!("Service {} stopped", name),
                        Err(e) => error!("Failed to stop service {}: {}", name, e),
                    }
                }
            } else {
                // 停止所有服务
                let results = manager.stop_all().await?;
                for (name, result) in results {
                    match result {
                        Ok(()) => info!("Service {} stopped", name),
                        Err(e) => error!("Failed to stop service {}: {}", name, e),
                    }
                }
            }
        }

        Commands::Restart { service } => {
            match manager.restart_service(&service).await {
                Ok(()) => info!("Service {} restarted", service),
                Err(e) => error!("Failed to restart service {}: {}", service, e),
            }
        }

        Commands::Status { service } => {
            if let Some(name) = service {
                // 显示单个服务状态
                if let Some(status) = manager.get_service_status(&name) {
                    print_service_status(&status);
                } else {
                    error!("Service {} not found", name);
                }
            } else {
                // 显示所有服务状态
                let statuses = manager.get_all_statuses();
                let overall = manager.get_system_status().await;

                println!("\n=== System Status: {} ===\n", overall.description());

                for status in statuses {
                    print_service_status(&status);
                }
            }
        }

        Commands::Dev { frontend } => {
            info!("Starting development mode...");

            // 启动所有服务
            let results = manager.start_all().await?;
            let mut all_ok = true;

            for (name, result) in results {
                match result {
                    Ok(()) => info!("Service {} started", name),
                    Err(e) => {
                        error!("Failed to start service {}: {}", name, e);
                        all_ok = false;
                    }
                }
            }

            if !all_ok {
                error!("Some services failed to start, shutting down...");
                manager.shutdown().await?;
                return Ok(());
            }

            // 如果需要，启动前端
            if frontend {
                let run_mode = manager.get_run_mode().await;
                if run_mode.is_dev() {
                    info!("Starting frontend...");
                    // TODO: 启动前端进程
                }
            }

            info!("All services started. Press Ctrl+C to stop.");

            // 等待 Ctrl+C
            tokio::signal::ctrl_c().await?;

            info!("Shutting down...");
            manager.shutdown().await?;
        }

        Commands::Logs { service, level, follow } => {
            let aggregator = manager.get_log_aggregator();

            if follow {
                // 实时跟踪日志
                info!("Following logs... Press Ctrl+C to exit");
                let mut last_count = 0;

                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

                    let logs = if let Some(ref svc) = service {
                        aggregator.get_service_logs(svc, 100).await
                    } else {
                        aggregator.get_all(100).await
                    };

                    for (i, log) in logs.iter().enumerate().skip(last_count) {
                        print_log_entry(log);
                        last_count = i + 1;
                    }
                }
            } else {
                // 显示历史日志
                let logs = if let Some(svc) = service {
                    aggregator.get_service_logs(&svc, 100).await
                } else {
                    aggregator.get_all(100).await
                };

                for log in logs {
                    print_log_entry(&log);
                }
            }
        }
    }

    Ok(())
}

fn print_service_status(status: &types::ServiceStatusInfo) {
    let health_icon = match status.health_status {
        types::HealthStatus::Healthy => "✅",
        types::HealthStatus::Unhealthy => "❌",
        types::HealthStatus::Checking => "⏳",
        types::HealthStatus::Unknown => "❓",
    };

    println!(
        "{} {:20} {:12} {:10} PID: {:<8} Uptime: {:<10}",
        health_icon,
        status.name,
        status.status.description(),
        format!("{:?}", status.health_status),
        status.pid.map(|p| p.to_string()).unwrap_or_else(|| "-".to_string()),
        status.uptime_display(),
    );

    if let Some(ref error) = status.last_error {
        println!("    Error: {}", error);
    }
}

fn print_log_entry(entry: &types::LogEntry) {
    let level_color = match entry.level {
        types::LogLevel::Error => "\x1b[31m", // Red
        types::LogLevel::Warn => "\x1b[33m",  // Yellow
        types::LogLevel::Info => "\x1b[32m",  // Green
        types::LogLevel::Debug => "\x1b[36m", // Cyan
    };
    let reset = "\x1b[0m";

    println!(
        "[{}] [{}] {}{:5}{} {}",
        entry.timestamp.format("%Y-%m-%d %H:%M:%S"),
        entry.service,
        level_color,
        entry.level.as_str(),
        reset,
        entry.message
    );
}
