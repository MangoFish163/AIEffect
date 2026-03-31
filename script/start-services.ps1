# AIEffect Service Manager 启动脚本
# 使用 Rust 实现的服务生命周期管理器
#
# 用法:
#   .\start-services.ps1              # 启动所有服务
#   .\start-services.ps1 -Status      # 查看服务状态
#   .\start-services.ps1 -Stop        # 停止所有服务
#   .\start-services.ps1 -Build       # 构建服务管理器
#   .\start-services.ps1 -Help        # 显示帮助

param(
    [switch]$Status,
    [switch]$Stop,
    [switch]$Build,
    [switch]$Help,
    [switch]$Dev
)

if ($Help) {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  AIEffect - 服务生命周期管理器" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "用法:" -ForegroundColor Yellow
    Write-Host "  .\start-services.ps1              启动所有服务" -ForegroundColor White
    Write-Host "  .\start-services.ps1 -Status      查看服务状态" -ForegroundColor White
    Write-Host "  .\start-services.ps1 -Stop        停止所有服务" -ForegroundColor White
    Write-Host "  .\start-services.ps1 -Build       构建服务管理器" -ForegroundColor White
    Write-Host "  .\start-services.ps1 -Dev         开发模式（启动前端）" -ForegroundColor White
    Write-Host "  .\start-services.ps1 -Help        显示此帮助信息" -ForegroundColor White
    Write-Host ""
    Write-Host "说明:" -ForegroundColor Yellow
    Write-Host "  - 此脚本使用 Rust 实现的服务管理器替代了原来的 PowerShell 脚本" -ForegroundColor Gray
    Write-Host "  - 支持优雅关闭、健康检查、自动重启等功能" -ForegroundColor Gray
    Write-Host "  - 需要先安装 Rust 工具链才能构建" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  AIEffect - 服务生命周期管理器" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Rust 是否安装
function Test-RustInstalled {
    try {
        $rustVersion = rustc --version 2>&1
        Write-Host "Rust: $rustVersion" -ForegroundColor Green
        return $true
    } catch {
        return $false
    }
}

# 构建服务管理器
function Build-ServiceManager {
    Write-Host "正在构建服务管理器..." -ForegroundColor Yellow

    if (-not (Test-RustInstalled)) {
        Write-Host "错误: 未找到 Rust，请先安装 Rust 工具链" -ForegroundColor Red
        Write-Host "访问 https://rustup.rs/ 安装 Rust" -ForegroundColor Gray
        exit 1
    }

    Set-Location (Join-Path $ProjectRoot "service-manager")

    # 检查是否已构建
    if (-not (Test-Path "target\release\service-manager.exe")) {
        Write-Host "首次构建，这可能需要几分钟..." -ForegroundColor Yellow
        cargo build --release
    } else {
        Write-Host "服务管理器已存在，跳过构建" -ForegroundColor Green
        Write-Host "使用 -Build 参数强制重新构建" -ForegroundColor Gray
    }

    Set-Location $ProjectRoot
}

# 主逻辑
if ($Build) {
    Build-ServiceManager
    exit 0
}

# 检查服务管理器是否存在
$ServiceManagerPath = Join-Path $ProjectRoot "service-manager\target\release\service-manager.exe"
if (-not (Test-Path $ServiceManagerPath)) {
    Write-Host "服务管理器未找到，正在构建..." -ForegroundColor Yellow
    Build-ServiceManager
}

# 执行命令
if ($Status) {
    Write-Host "查看服务状态..." -ForegroundColor Cyan
    & $ServiceManagerPath --project-root $ProjectRoot status
} elseif ($Stop) {
    Write-Host "停止所有服务..." -ForegroundColor Red
    & $ServiceManagerPath --project-root $ProjectRoot stop
} elseif ($Dev) {
    Write-Host "启动开发模式..." -ForegroundColor Cyan
    & $ServiceManagerPath --project-root $ProjectRoot dev
} else {
    Write-Host "启动所有服务..." -ForegroundColor Green
    Write-Host ""
    Write-Host "服务列表:" -ForegroundColor Yellow
    Write-Host "  - Log Service:    http://localhost:8505" -ForegroundColor White
    Write-Host "  - API Gateway:    http://localhost:8501" -ForegroundColor White
    Write-Host "  - WebSocket:      ws://localhost:8502" -ForegroundColor White
    Write-Host ""
    Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Gray
    Write-Host ""

    & $ServiceManagerPath --project-root $ProjectRoot start
}
