# AIEffect 开发环境一键启动脚本
# 同时启动前端和后端开发服务器

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  AIEffect - 开发环境启动" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Python 是否安装
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到 Python，请先安装 Python 3.11+" -ForegroundColor Red
    exit 1
}

# 检查 Node.js 是否安装
try {
    $nodeVersion = node --version
    Write-Host "Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到 Node.js，请先安装 Node.js" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 后端路径
$BackendPath = Join-Path $ProjectRoot "backend"
# 前端路径
$FrontendPath = Join-Path $ProjectRoot "frontend"

# 创建日志目录
$LogDir = Join-Path $ProjectRoot "logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

Write-Host "检查后端依赖..." -ForegroundColor Yellow
Set-Location $BackendPath
if (-not (Test-Path "venv")) {
    Write-Host "  创建虚拟环境..." -ForegroundColor Gray
    python -m venv venv
}

# 激活虚拟环境并安装依赖
$venvActivate = Join-Path $BackendPath "venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    . $venvActivate
    Write-Host "  安装 Python 依赖..." -ForegroundColor Gray
    pip install -r requirements.txt -q
    Write-Host "后端依赖就绪" -ForegroundColor Green
}

Write-Host ""
Write-Host "检查前端依赖..." -ForegroundColor Yellow
Set-Location $FrontendPath
if (-not (Test-Path "node_modules")) {
    Write-Host "  安装 npm 依赖..." -ForegroundColor Gray
    npm install
}
Write-Host "前端依赖就绪" -ForegroundColor Green

Write-Host ""
Write-Host "启动服务..." -ForegroundColor Cyan
Write-Host ""

# 返回项目根目录
Set-Location $ProjectRoot

# 定义函数来启动后端
function Start-Backend {
    Write-Host "[后端] 正在启动..." -ForegroundColor Blue
    Set-Location $BackendPath
    if (Test-Path "venv\Scripts\Activate.ps1") {
        . "venv\Scripts\Activate.ps1"
    }
    python src/main.py
}

# 定义函数来启动前端
function Start-Frontend {
    Write-Host "[前端] 正在启动..." -ForegroundColor Magenta
    Set-Location $FrontendPath
    npm run dev
}

# 使用 Start-Job 在后台启动服务
$backendJob = Start-Job -ScriptBlock ${function:Start-Backend}
Start-Sleep -Seconds 3

$frontendJob = Start-Job -ScriptBlock ${function:Start-Frontend}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  所有服务已启动!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "服务状态:" -ForegroundColor Yellow
Write-Host "  - 后端 API: http://localhost:8500" -ForegroundColor White
Write-Host "  - 前端开发: http://localhost:5173" -ForegroundColor White
Write-Host "  - API 文档: http://localhost:8500/docs" -ForegroundColor White
Write-Host ""
Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Gray
Write-Host ""

# 监听输出
try {
    while ($true) {
        # 获取后端输出
        if ($backendJob.HasMoreData) {
            Receive-Job -Job $backendJob | ForEach-Object {
                Write-Host "[后端] $_" -ForegroundColor Blue
            }
        }
        
        # 获取前端输出
        if ($frontendJob.HasMoreData) {
            Receive-Job -Job $frontendJob | ForEach-Object {
                Write-Host "[前端] $_" -ForegroundColor Magenta
            }
        }
        
        Start-Sleep -Milliseconds 100
    }
} finally {
    Write-Host ""
    Write-Host "正在停止服务..." -ForegroundColor Red
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "所有服务已停止" -ForegroundColor Green
}
