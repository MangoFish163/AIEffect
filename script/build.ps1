# AIEffect 一键打包脚本
# 构建前后端并打包为桌面应用

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  AIEffect - 桌面应用打包" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 后端路径
$BackendPath = Join-Path $ProjectRoot "backend"
# 前端路径
$FrontendPath = Join-Path $ProjectRoot "frontend"
# 输出目录
$DistPath = Join-Path $ProjectRoot "dist"

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

# 清理旧的构建文件
Write-Host "清理旧构建文件..." -ForegroundColor Yellow
if (Test-Path $DistPath) {
    Remove-Item -Path $DistPath -Recurse -Force
}
New-Item -ItemType Directory -Path $DistPath | Out-Null
Write-Host "清理完成" -ForegroundColor Green

Write-Host ""

# 构建后端
Write-Host "构建后端..." -ForegroundColor Yellow
Set-Location $BackendPath

# 创建虚拟环境（如果不存在）
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
    
    # 检查是否有 nuitka
    $nuitkaInstalled = pip list | Select-String -Pattern "nuitka"
    if (-not $nuitkaInstalled) {
        Write-Host "  安装 Nuitka..." -ForegroundColor Gray
        pip install nuitka -q
    }
    
    Write-Host "  使用 Python 直接运行模式（开发版）" -ForegroundColor Gray
    # 复制后端源码到 dist
    $BackendDist = Join-Path $DistPath "backend"
    Copy-Item -Path "src" -Destination $BackendDist -Recurse
    Copy-Item -Path "requirements.txt" -Destination $BackendDist
    Copy-Item -Path "pyproject.toml" -Destination $BackendDist
    Copy-Item -Path ".env.example" -Destination $BackendDist
    if (Test-Path ".env") {
        Copy-Item -Path ".env" -Destination $BackendDist
    }
    
    # 创建 data 目录
    $BackendData = Join-Path $BackendDist "data"
    New-Item -ItemType Directory -Path $BackendData | Out-Null
    $BackendMemories = Join-Path $BackendData "memories"
    New-Item -ItemType Directory -Path $BackendMemories | Out-Null
}

Write-Host "后端构建完成" -ForegroundColor Green
Write-Host ""

# 构建前端
Write-Host "构建前端..." -ForegroundColor Yellow
Set-Location $FrontendPath

# 安装依赖
if (-not (Test-Path "node_modules")) {
    Write-Host "  安装 npm 依赖..." -ForegroundColor Gray
    npm install
}

# 构建前端
Write-Host "  执行 Vite 构建..." -ForegroundColor Gray
npm run build

# 复制构建结果
$FrontendDist = Join-Path $DistPath "frontend"
Copy-Item -Path "dist" -Destination $FrontendDist -Recurse
Copy-Item -Path "package.json" -Destination $FrontendDist

Write-Host "前端构建完成" -ForegroundColor Green
Write-Host ""

# 创建启动脚本
Write-Host "创建启动脚本..." -ForegroundColor Yellow

$StartScript = @"
@echo off
chcp 65001 >nul
echo ==========================================
echo   AIEffect - AI 语音交互适配器
echo ==========================================
echo.

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.11+
    pause
    exit /b 1
)

REM 启动后端
echo [信息] 正在启动后端服务...
cd /d "%~dp0backend"
if not exist "venv" (
    echo [信息] 创建虚拟环境...
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt -q
start "AIEffect Backend" cmd /k "python src/main.py"

REM 等待后端启动
timeout /t 3 /nobreak >nul

REM 启动前端
echo [信息] 正在启动前端服务...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo [信息] 安装前端依赖...
    call npm install
)
start "AIEffect Frontend" cmd /k "npm run preview"

echo.
echo ==========================================
echo   服务已启动!
echo ==========================================
echo   后端: http://localhost:8500
echo   前端: http://localhost:4173
echo   API文档: http://localhost:8500/docs
echo.
echo 按任意键关闭此窗口（服务继续运行）
pause >nul
"@

$StartScriptPath = Join-Path $DistPath "start.bat"
Set-Content -Path $StartScriptPath -Value $StartScript -Encoding UTF8

Write-Host "启动脚本已创建" -ForegroundColor Green
Write-Host ""

Write-Host "==========================================" -ForegroundColor Green
Write-Host "  构建完成!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "输出目录: $DistPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "运行方式:" -ForegroundColor Cyan
Write-Host "  双击 $DistPath\start.bat" -ForegroundColor White
Write-Host ""
Write-Host "访问地址:" -ForegroundColor Yellow
Write-Host "  - 后端 API: http://localhost:8500" -ForegroundColor White
Write-Host "  - 前端预览: http://localhost:4173" -ForegroundColor White
Write-Host "  - API 文档: http://localhost:8500/docs" -ForegroundColor White
Write-Host ""

# 返回到项目根目录
Set-Location $ProjectRoot
