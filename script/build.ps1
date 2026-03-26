# AIEffect 一键打包脚本
# 构建前后端并打包为桌面应用
# 版本: 2.0.0

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

# 脚本配置
$Script:Config = @{
    Ports = @{
        Frontend = 8500
        ApiGateway = 8501
        WebSocket = 8502
        LogService = 8505
    }
    ServiceNames = @("API Gateway", "WebSocket", "Log Service")
}

# 路径配置
$Paths = @{
    ApiGateway = Join-Path $ProjectRoot "services\api_gateway"
    WebSocket = Join-Path $ProjectRoot "services\websocket"
    LogService = Join-Path $ProjectRoot "services\log"
    SharedCore = Join-Path $ProjectRoot "shared\python"
    Frontend = Join-Path $ProjectRoot "frontend"
    Dist = Join-Path $ProjectRoot "dist"
    Data = Join-Path $ProjectRoot "dist\data"
}

# 日志函数
function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# 检查命令是否存在
function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# 清理并创建目录
function Initialize-Directory {
    param([string]$Path)
    if (Test-Path $Path) {
        Remove-Item -Path $Path -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

# 构建 Python 服务
function Build-PythonService {
    param(
        [string]$ServicePath,
        [string]$ServiceName,
        [string]$DistPath
    )

    Write-Info "构建 $ServiceName..."
    Set-Location $ServicePath

    # 检查虚拟环境
    if (-not (Test-Path "venv")) {
        throw "虚拟环境不存在，请先运行 .\script\start-dev.ps1 -Init 初始化环境"
    }

    $venvPython = Join-Path $ServicePath "venv\Scripts\python.exe"
    $venvPip = Join-Path $ServicePath "venv\Scripts\pip.exe"

    # 安装依赖
    Write-Info "安装 $ServiceName 依赖..."
    & $venvPip install -r requirements.txt -q
    if ($LASTEXITCODE -ne 0) { throw "依赖安装失败" }

    # 安装共享包
    Write-Info "安装共享核心包到 $ServiceName..."
    & $venvPip install -e $Paths.SharedCore -q
    if ($LASTEXITCODE -ne 0) { throw "共享包安装失败" }

    # 创建目标目录
    New-Item -ItemType Directory -Path $DistPath -Force | Out-Null

    # 复制源代码
    Copy-Item -Path "src" -Destination $DistPath -Recurse -Force
    Copy-Item -Path "start.py" -Destination $DistPath -Force
    Copy-Item -Path "requirements.txt" -Destination $DistPath -Force
    if (Test-Path "pyproject.toml") {
        Copy-Item -Path "pyproject.toml" -Destination $DistPath -Force
    }

    # 复制虚拟环境（仅必要文件）
    $venvDist = Join-Path $DistPath "venv"
    New-Item -ItemType Directory -Path $venvDist -Force | Out-Null
    Copy-Item -Path "venv\Scripts" -Destination $venvDist -Recurse -Force
    Copy-Item -Path "venv\Lib" -Destination $venvDist -Recurse -Force
    Copy-Item -Path "venv\pyvenv.cfg" -Destination $venvDist -Force

    Write-Success "$ServiceName 构建完成"
}

# ==================== 主流程 ====================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  AIEffect - 桌面应用打包 v2.0" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Python
if (-not (Test-Command "python")) {
    Write-Error "未找到 Python，请先安装 Python 3.10+"
    exit 1
}
$pythonVersion = python --version 2>&1
Write-Success "Python: $pythonVersion"

# 检查 Node.js
if (-not (Test-Command "node")) {
    Write-Error "未找到 Node.js，请先安装 Node.js 18+"
    exit 1
}
$nodeVersion = node --version
Write-Success "Node.js: $nodeVersion"

Write-Host ""

# 清理旧构建
Write-Info "清理旧构建文件..."
Initialize-Directory -Path $Paths.Dist
Write-Success "清理完成"

Write-Host ""

# 构建日志服务
try {
    $logDist = Join-Path $Paths.Dist "services\log"
    Build-PythonService `
        -ServicePath $Paths.LogService `
        -ServiceName "日志服务" `
        -DistPath $logDist
} catch {
    Write-Error "日志服务构建失败: $_"
    exit 1
}

Write-Host ""

# 构建 API Gateway
try {
    $apiDist = Join-Path $Paths.Dist "services\api_gateway"
    Build-PythonService `
        -ServicePath $Paths.ApiGateway `
        -ServiceName "API Gateway" `
        -DistPath $apiDist
} catch {
    Write-Error "API Gateway 构建失败: $_"
    exit 1
}

Write-Host ""

# 构建 WebSocket 服务
try {
    $wsDist = Join-Path $Paths.Dist "services\websocket"
    Build-PythonService `
        -ServicePath $Paths.WebSocket `
        -ServiceName "WebSocket 服务" `
        -DistPath $wsDist
} catch {
    Write-Error "WebSocket 服务构建失败: $_"
    exit 1
}

Write-Host ""

# 复制共享包
Write-Info "复制共享核心包..."
$sharedDist = Join-Path $Paths.Dist "shared\python"
Initialize-Directory -Path $sharedDist
Copy-Item -Path "$($Paths.SharedCore)\shared_core" -Destination $sharedDist -Recurse -Force
Copy-Item -Path "$($Paths.SharedCore)\pyproject.toml" -Destination $sharedDist -Force
Write-Success "共享包复制完成"

Write-Host ""

# 构建前端
Write-Info "构建前端..."
Set-Location $Paths.Frontend

# 安装依赖
if (-not (Test-Path "node_modules")) {
    Write-Warning "安装 npm 依赖..."
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm 依赖安装失败" }
}

# 构建
Write-Info "执行 Vite 构建..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "前端构建失败" }

# 复制构建结果
$frontendDist = Join-Path $Paths.Dist "frontend"
Initialize-Directory -Path $frontendDist
Copy-Item -Path "dist\*" -Destination $frontendDist -Recurse -Force
Copy-Item -Path "package.json" -Destination $frontendDist -Force
Copy-Item -Path "package-lock.json" -Destination $frontendDist -Force

Write-Success "前端构建完成"

Write-Host ""

# 创建数据目录
Write-Info "创建数据目录..."
$dataDist = Join-Path $Paths.Dist "data"
$memoriesDist = Join-Path $dataDist "memories"
$logsDist = Join-Path $dataDist "logs"

New-Item -ItemType Directory -Path $memoriesDist -Force | Out-Null
New-Item -ItemType Directory -Path $logsDist -Force | Out-Null

# 复制默认配置
if (Test-Path "$ProjectRoot\.env.example") {
    Copy-Item -Path "$ProjectRoot\.env.example" -Destination "$($Paths.Dist)\.env.example" -Force
}
Write-Success "数据目录创建完成"

Write-Host ""

# 创建启动脚本
Write-Info "创建启动脚本..."

$startBat = @'
@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "PIDS_FILE=%SCRIPT_DIR%.service_pids"

echo ==========================================
echo   AIEffect - AI 交互 Agent
echo ==========================================
echo.

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)

REM 清理旧的 PID 文件
if exist "%PIDS_FILE%" del "%PIDS_FILE%"

REM 启动日志服务
echo [信息] 正在启动日志服务...
cd /d "%SCRIPT_DIR%services\log"
if not exist "venv" (
    echo [错误] 虚拟环境不存在，请重新构建
    pause
    exit /b 1
)
call venv\Scripts\activate.bat
start /B "AIEffect Log Service" cmd /c "python start.py > ..\..\data\logs\log_service.log 2>&1"
echo !ERRORLEVEL! >> "%PIDS_FILE%"
timeout /t 2 /nobreak >nul

REM 启动 API Gateway
echo [信息] 正在启动 API Gateway...
cd /d "%SCRIPT_DIR%services\api_gateway"
call venv\Scripts\activate.bat
start /B "AIEffect API Gateway" cmd /c "python start.py > ..\..\data\logs\api_gateway.log 2>&1"
echo !ERRORLEVEL! >> "%PIDS_FILE%"
timeout /t 2 /nobreak >nul

REM 启动 WebSocket 服务
echo [信息] 正在启动 WebSocket 服务...
cd /d "%SCRIPT_DIR%services\websocket"
call venv\Scripts\activate.bat
start /B "AIEffect WebSocket" cmd /c "python start.py > ..\..\data\logs\websocket.log 2>&1"
echo !ERRORLEVEL! >> "%PIDS_FILE%"
timeout /t 2 /nobreak >nul

REM 启动前端
echo [信息] 正在启动前端服务...
cd /d "%SCRIPT_DIR%frontend"
if not exist "node_modules" (
    echo [信息] 安装前端依赖...
    call npm ci
)
start /B "AIEffect Frontend" cmd /c "npm run preview -- --port 8500 > ..\data\logs\frontend.log 2>&1"
echo !ERRORLEVEL! >> "%PIDS_FILE%"
timeout /t 3 /nobreak >nul

echo.
echo ==========================================
echo   服务已启动!
echo ==========================================
echo   API Gateway: http://localhost:8501
echo   WebSocket:   ws://localhost:8502
echo   日志服务:    http://localhost:8505
echo   前端:        http://localhost:8500
echo   API文档:     http://localhost:8501/docs
echo.
echo 运行 stop.bat 可关闭所有服务
echo.
pause
'@

$startScriptPath = Join-Path $Paths.Dist "start.bat"
Set-Content -Path $startScriptPath -Value $startBat -Encoding UTF8

# 创建停止脚本
$stopBat = @'
@echo off
chcp 65001 >nul
set "SCRIPT_DIR=%~dp0"
set "PIDS_FILE=%SCRIPT_DIR%.service_pids"

echo ==========================================
echo   AIEffect - 停止服务
echo ==========================================
echo.

REM 停止所有相关进程
echo [信息] 正在停止服务...

taskkill /FI "WINDOWTITLE eq AIEffect Log Service" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq AIEffect API Gateway" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq AIEffect WebSocket" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq AIEffect Frontend" /F >nul 2>&1

REM 停止 Python 进程
taskkill /IM python.exe /FI "COMMANDLINE eq *start.py*" /F >nul 2>&1

REM 停止 Node 进程
taskkill /IM node.exe /FI "COMMANDLINE eq *vite*" /F >nul 2>&1

REM 清理 PID 文件
if exist "%PIDS_FILE%" del "%PIDS_FILE%"

echo [信息] 所有服务已停止
echo.
pause
'@

$stopScriptPath = Join-Path $Paths.Dist "stop.bat"
Set-Content -Path $stopScriptPath -Value $stopBat -Encoding UTF8

Write-Success "启动脚本已创建"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  构建完成!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "输出目录: $($Paths.Dist)" -ForegroundColor Yellow
Write-Host ""
Write-Host "运行方式:" -ForegroundColor Cyan
Write-Host "  1. 双击 $($Paths.Dist)\start.bat 启动服务" -ForegroundColor White
Write-Host "  2. 双击 $($Paths.Dist)\stop.bat 停止服务" -ForegroundColor White
Write-Host ""
Write-Host "访问地址:" -ForegroundColor Yellow
Write-Host "  - API Gateway: http://localhost:$($Script:Config.Ports.ApiGateway)" -ForegroundColor White
Write-Host "  - WebSocket:   ws://localhost:$($Script:Config.Ports.WebSocket)" -ForegroundColor White
Write-Host "  - 日志服务:    http://localhost:$($Script:Config.Ports.LogService)" -ForegroundColor White
Write-Host "  - 前端预览:    http://localhost:$($Script:Config.Ports.Frontend)" -ForegroundColor White
Write-Host "  - API 文档:    http://localhost:$($Script:Config.Ports.ApiGateway)/docs" -ForegroundColor White
Write-Host ""

# 返回项目根目录
Set-Location $ProjectRoot
