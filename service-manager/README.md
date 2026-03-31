# AIEffect Service Manager

AIEffect 服务生命周期管理器 - 基于 Rust 的高性能进程管理工具。

## 功能特性

- **零僵尸进程**: 使用 Windows Job Object 确保子进程随父进程终止
- **优雅关闭**: 三级关闭策略（HTTP /shutdown → 信号 → 强制终止）
- **自动恢复**: 服务崩溃后自动重启，支持重启次数限制
- **依赖管理**: 基于拓扑排序的服务启动顺序控制
- **健康检查**: HTTP 健康检查端点轮询
- **运行模式**: 支持开发模式（npm run dev）和生产模式
- **日志聚合**: 统一收集和查询所有服务的日志
- **跨平台**: 支持 Windows、macOS、Linux

## 快速开始

### 1. 构建服务管理器

```powershell
# 使用 PowerShell 脚本自动构建
cd script
.\start-services.ps1 -Build

# 或者手动构建
cd service-manager
cargo build --release
```

### 2. 启动所有服务

```powershell
cd script
.\start-services.ps1
```

### 3. 查看服务状态

```powershell
.\start-services.ps1 -Status
```

### 4. 停止所有服务

```powershell
.\start-services.ps1 -Stop
```

### 5. 开发模式（启动前端）

```powershell
.\start-services.ps1 -Dev
```

## 命令行用法

```bash
# 构建
python .\script\start-services.py -Build

# 启动所有服务
python .\script\start-services.py

# 查看状态
python .\script\start-services.py -Status

# 停止所有服务
python .\script\start-services.py -Stop

# 开发模式
python .\script\start-services.py -Dev


# 启动所有服务
service-manager start

# 启动指定服务
service-manager start --service log-service

# 停止所有服务
service-manager stop

# 停止指定服务
service-manager stop --service api-gateway

# 重启服务
service-manager restart api-gateway

# 查看状态
service-manager status

# 查看指定服务状态
service-manager status api-gateway

# 查看日志
service-manager logs

# 实时跟踪日志
service-manager logs --follow

# 查看指定服务日志
service-manager logs --service log-service
```

## 项目结构

```
service-manager/
├── Cargo.toml              # Rust 项目配置
├── src/
│   ├── main.rs             # CLI 入口
│   ├── lib.rs              # 库入口
│   ├── types/              # 类型定义
│   │   ├── mod.rs
│   │   ├── config.rs       # 配置结构
│   │   └── status.rs       # 状态枚举
│   └── service_manager/    # 核心模块
│       ├── mod.rs          # 服务管理器
│       ├── error.rs        # 错误类型
│       ├── health.rs       # 健康检查
│       ├── dependency.rs   # 依赖管理
│       ├── shutdown.rs     # 优雅关闭
│       ├── log_aggregator.rs # 日志聚合
│       └── platform/       # 平台适配
│           ├── mod.rs
│           ├── windows.rs  # Windows 实现
│           └── unix.rs     # Unix 实现
```

## 服务配置

服务配置位于 `service-manager/src/types/config.rs`，默认配置如下：

| 服务        | 端口 | 依赖        | 健康检查    |
| ----------- | ---- | ----------- | ----------- |
| log-service | 8505 | 无          | /health     |
| api-gateway | 8501 | log-service | /api/health |
| websocket   | 8502 | api-gateway | /health     |

## 运行模式

### 开发模式

- 前端使用 `npm run dev` 启动，支持热重载
- 详细日志输出
- 启用调试工具

### 生产模式

- 前端由 Tauri WebView 直接托管
- 无独立前端进程
- 日志级别为 Info 或更高

切换运行模式：

```bash
# 环境变量方式
$env:AI_EFFECT_MODE="development"  # 或 "production"

# 标记文件方式
New-Item .development  # 开发模式标记
```

## 关闭策略

服务管理器使用三级关闭策略：

1. **HTTP /shutdown** (首选): 发送 POST 请求到服务的 /shutdown 端点
   - 超时: 5 秒
   - 服务收到后自行清理并退出

2. **信号发送** (备选): 发送 Ctrl+C (Windows) 或 SIGTERM (Unix)
   - 超时: 3 秒
   - 触发 Python 信号处理器

3. **强制终止** (最后手段): 使用 TerminateProcess (Windows) 或 SIGKILL (Unix)
   - 立即执行
   - 不保证资源清理

## Windows 平台特殊处理

### Job Object

使用 Windows Job Object API 确保子进程随父进程终止：

```rust
// 配置作业对象：当最后一个句柄关闭时终止所有进程
info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
```

### 进程组

使用 `CREATE_NEW_PROCESS_GROUP` 标志创建新进程组，便于信号管理。

## 依赖管理

使用 Kahn 算法进行拓扑排序，确保服务按正确顺序启动：

```
启动顺序: log-service → api-gateway → websocket
关闭顺序: websocket → api-gateway → log-service
```

## 健康检查

- 间隔: 5 秒
- 超时: 5 秒
- 端点: 可配置的 HTTP /health 路径
- 自动重启: 根据 RestartPolicy 配置

## 日志聚合

- 缓冲区大小: 10000 条
- 支持按服务、级别、时间范围过滤
- 支持关键词搜索

## 故障排除

### 端口被占用

```powershell
# 查找占用端口的进程
Get-NetTCPConnection -LocalPort 8501

# 终止进程
Stop-Process -Id <PID>
```

### 僵尸进程

如果发现有残留进程：

```powershell
# 终止所有 Python 进程
Get-Process python | Stop-Process -Force

# 或者使用服务管理器强制清理
.\start-services.ps1 -Stop
```

### 构建失败

确保已安装 Rust 工具链：

```powershell
# 安装 Rust
Invoke-WebRequest https://win.rustup.rs/x86_64 -OutFile rustup-init.exe
.\rustup-init.exe

# 验证安装
rustc --version
cargo --version
```

## 开发计划

- [x] 基础进程管理
- [x] 优雅关闭
- [x] 健康检查
- [x] 依赖管理
- [x] 运行模式支持
- [x] 日志聚合
- [x] Windows 平台适配
- [ ] Unix 平台测试
- [ ] Tauri 集成
- [ ] Web UI 状态面板
- [ ] 配置文件支持

## 许可证

MIT License
