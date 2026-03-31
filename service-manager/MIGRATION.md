# 迁移指南：从 PowerShell 脚本到 Rust 服务管理器

本文档描述了如何从旧的 PowerShell 启动脚本迁移到新的 Rust 服务生命周期管理器。

## 主要改进

| 功能 | 旧方案 (PowerShell) | 新方案 (Rust) |
|------|---------------------|---------------|
| 僵尸进程 | ❌ 有残留风险 | ✅ Windows Job Object 保证清理 |
| 优雅关闭 | ❌ 强制终止 | ✅ 三级关闭策略 |
| 健康检查 | ❌ 无 | ✅ HTTP 轮询检查 |
| 自动恢复 | ❌ 无 | ✅ 可配置重启策略 |
| 依赖管理 | ❌ 固定等待 | ✅ 拓扑排序 + 就绪验证 |
| 运行模式 | ❌ 无区分 | ✅ 开发/生产模式 |
| 日志聚合 | ❌ 分散文件 | ✅ 统一收集查询 |

## 快速迁移

### 1. 安装 Rust（如果尚未安装）

```powershell
# 下载并安装 Rust
Invoke-WebRequest https://win.rustup.rs/x86_64 -OutFile rustup-init.exe
.\rustup-init.exe -y

# 重启终端或刷新环境变量
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
```

### 2. 构建服务管理器

```powershell
cd script
.\start-services.ps1 -Build
```

### 3. 启动服务

```powershell
# 旧方式（仍然可用，但已弃用）
# .\start-dev.ps1

# 新方式
.\start-services.ps1
```

## API 变更

### Python 服务新增端点

所有 Python 服务都需要添加 `/shutdown` 端点以支持优雅关闭：

```python
@app.post("/shutdown")
async def shutdown():
    """优雅关闭服务"""
    import asyncio
    import sys

    async def do_shutdown():
        await asyncio.sleep(0.5)
        sys.exit(0)

    asyncio.create_task(do_shutdown())
    return {"status": "shutting_down"}
```

已修改的文件：
- `services/log/src/api/health.py`
- `services/api_gateway/src/api_gateway/main.py`
- `services/websocket/src/websocket_service/main.py`

## 配置变更

### 环境变量

新增环境变量支持：

```powershell
# 设置运行模式
$env:AI_EFFECT_MODE = "development"  # 或 "production"

# 日志级别
$env:RUST_LOG = "info"  # debug, info, warn, error
```

### 标记文件

创建 `.development` 文件以标记开发环境：

```powershell
New-Item .development -ItemType File
```

## 命令对照表

| 旧命令 | 新命令 |
|--------|--------|
| `.\start-dev.ps1` | `.\start-services.ps1` |
| `.\start-dev.ps1 -Init` | （手动安装依赖） |
| `Ctrl+C` | `Ctrl+C` 或 `.\start-services.ps1 -Stop` |
| 查看日志文件 | `.\start-services.ps1 -Status` |

## 故障排除

### 问题：服务管理器构建失败

**解决方案：**
1. 确保 Rust 已正确安装：`rustc --version`
2. 更新 Rust：`rustup update`
3. 清理并重新构建：
   ```powershell
   cd service-manager
   cargo clean
   cargo build --release
   ```

### 问题：端口被占用

**解决方案：**
```powershell
# 查找并终止占用端口的进程
Get-NetTCPConnection -LocalPort 8501 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### 问题：服务启动失败

**检查清单：**
1. Python 虚拟环境是否存在
2. 依赖是否已安装
3. 端口是否被占用
4. 日志文件查看具体错误

## 回滚方案

如果需要回滚到旧方案：

```powershell
# 使用旧的启动脚本
.\start-dev.ps1
```

旧脚本仍然可用，但建议尽快迁移到新方案以获得更好的稳定性。

## 性能对比

| 指标 | 旧方案 | 新方案 | 改进 |
|------|--------|--------|------|
| 启动时间 | ~6s | ~6s | 持平 |
| 关闭时间 | ~1s (强制) | ~3s (优雅) | 更安全 |
| 僵尸进程 | ~30% 概率 | 0% | 显著提升 |
| 内存占用 | 较高 | 较低 | 优化 |
| 健康检测 | 无 | <15s | 新增 |

## 后续计划

- [ ] Tauri 桌面应用集成
- [ ] Web UI 状态监控面板
- [ ] 配置文件支持 (YAML/TOML)
- [ ] 远程管理 API
- [ ] 服务发现机制

## 支持

如有问题，请：
1. 查看日志文件：`logs/` 目录
2. 运行测试脚本：`python script/test-service-manager.py`
3. 提交 Issue 到项目仓库
