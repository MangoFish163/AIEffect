# AIEffect 开发环境一键启动脚本
# 同时启动前端和后端开发服务器
#
# 用法:
#   .\start-dev.ps1              # 直接启动服务（跳过依赖安装）
#   .\start-dev.ps1 -Init        # 初始化模式：创建虚拟环境并安装所有依赖
#   .\start-dev.ps1 -Help        # 显示帮助信息

param(
    [switch]$Init,
    [switch]$Help
)

if ($Help) {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  AIEffect - 开发环境启动脚本" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "用法:" -ForegroundColor Yellow
    Write-Host "  .\start-dev.ps1              直接启动服务（跳过依赖安装）" -ForegroundColor White
    Write-Host "  .\start-dev.ps1 -Init        初始化模式：创建虚拟环境并安装所有依赖" -ForegroundColor White
    Write-Host "  .\start-dev.ps1 -Help        显示此帮助信息" -ForegroundColor White
    Write-Host ""
    Write-Host "说明:" -ForegroundColor Yellow
    Write-Host "  - 首次运行或依赖变更时，请使用 -Init 参数" -ForegroundColor Gray
    Write-Host "  - 日常开发直接运行，无需参数，启动更快" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
if ($Init) {
    Write-Host "  AIEffect - 开发环境初始化并启动" -ForegroundColor Cyan
} else {
    Write-Host "  AIEffect - 开发环境启动" -ForegroundColor Cyan
}
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Python 是否安装
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到 Python，请先安装 Python 3.12+" -ForegroundColor Red
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

# 服务路径
$ApiGatewayPath = Join-Path $ProjectRoot "services\api_gateway"
$WebSocketPath = Join-Path $ProjectRoot "services\websocket"
$LogServicePath = Join-Path $ProjectRoot "services\log"
$SharedCorePath = Join-Path $ProjectRoot "shared\python"
# 前端路径
$FrontendPath = Join-Path $ProjectRoot "frontend"

# 创建日志目录
$LogDir = Join-Path $ProjectRoot "logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

# 创建数据目录
$DataDir = Join-Path $ProjectRoot "data"
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir | Out-Null
}

# ==================== 依赖安装阶段 ====================
if ($Init) {
    Write-Host "【初始化模式】正在安装/更新所有依赖..." -ForegroundColor Yellow
    Write-Host ""

    # 安装共享核心包
    Write-Host "安装共享核心包..." -ForegroundColor Yellow
    Set-Location $SharedCorePath
    pip install -e . -q
    Write-Host "共享核心包安装完成" -ForegroundColor Green

    Write-Host ""
    Write-Host "检查 API Gateway 依赖..." -ForegroundColor Yellow
    Set-Location $ApiGatewayPath
    if (-not (Test-Path "venv")) {
        Write-Host "  创建虚拟环境..." -ForegroundColor Gray
        python -m venv venv
    }

    $venvActivate = Join-Path $ApiGatewayPath "venv\Scripts\Activate.ps1"
    if (Test-Path $venvActivate) {
        . $venvActivate
        Write-Host "  安装 Python 依赖..." -ForegroundColor Gray
        pip install -r requirements.txt -q
        Write-Host "API Gateway 依赖就绪" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "检查 WebSocket 服务依赖..." -ForegroundColor Yellow
    Set-Location $WebSocketPath
    if (-not (Test-Path "venv")) {
        Write-Host "  创建虚拟环境..." -ForegroundColor Gray
        python -m venv venv
    }

    $venvActivate = Join-Path $WebSocketPath "venv\Scripts\Activate.ps1"
    if (Test-Path $venvActivate) {
        . $venvActivate
        Write-Host "  安装 Python 依赖..." -ForegroundColor Gray
        pip install -r requirements.txt -q
        Write-Host "WebSocket 服务依赖就绪" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "检查日志服务依赖..." -ForegroundColor Yellow
    Set-Location $LogServicePath
    if (-not (Test-Path "venv")) {
        Write-Host "  创建虚拟环境..." -ForegroundColor Gray
        python -m venv venv
    }

    $venvActivate = Join-Path $LogServicePath "venv\Scripts\Activate.ps1"
    if (Test-Path $venvActivate) {
        . $venvActivate
        Write-Host "  安装 Python 依赖..." -ForegroundColor Gray
        pip install -r requirements.txt -q
        Write-Host "日志服务依赖就绪" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "检查前端依赖..." -ForegroundColor Yellow
    Set-Location $FrontendPath
    if (-not (Test-Path "node_modules")) {
        Write-Host "  安装 npm 依赖..." -ForegroundColor Gray
        npm install
    } else {
        Write-Host "  更新 npm 依赖..." -ForegroundColor Gray
        npm install
    }
    Write-Host "前端依赖就绪" -ForegroundColor Green

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "  依赖安装完成!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
} else {
    # 快速模式：只检查必要环境是否存在
    Write-Host "【快速启动模式】跳过依赖安装..." -ForegroundColor DarkGray
    Write-Host ""

    # 检查虚拟环境是否存在
    $missingEnv = $false

    if (-not (Test-Path (Join-Path $ApiGatewayPath "venv"))) {
        Write-Host "[警告] API Gateway 虚拟环境不存在，请使用 -Init 参数初始化" -ForegroundColor Red
        $missingEnv = $true
    }
    if (-not (Test-Path (Join-Path $WebSocketPath "venv"))) {
        Write-Host "[警告] WebSocket 虚拟环境不存在，请使用 -Init 参数初始化" -ForegroundColor Red
        $missingEnv = $true
    }
    if (-not (Test-Path (Join-Path $LogServicePath "venv"))) {
        Write-Host "[警告] 日志服务虚拟环境不存在，请使用 -Init 参数初始化" -ForegroundColor Red
        $missingEnv = $true
    }
    if (-not (Test-Path (Join-Path $FrontendPath "node_modules"))) {
        Write-Host "[警告] 前端 node_modules 不存在，请使用 -Init 参数初始化" -ForegroundColor Red
        $missingEnv = $true
    }

    if ($missingEnv) {
        Write-Host ""
        Write-Host "首次运行或环境缺失，请执行:" -ForegroundColor Yellow
        Write-Host "  .\start-dev.ps1 -Init" -ForegroundColor Cyan
        Write-Host ""
        exit 1
    }

    Write-Host "环境检查通过，准备启动服务..." -ForegroundColor Green
    Write-Host ""
}

# ==================== 服务启动阶段 ====================
Write-Host "启动服务..." -ForegroundColor Cyan
Write-Host ""

# 返回项目根目录
Set-Location $ProjectRoot

# 创建日志文件路径
$LogServiceLog = Join-Path $LogDir "log-service.log"
$LogServiceErr = Join-Path $LogDir "log-service-error.log"
$ApiGatewayLog = Join-Path $LogDir "api-gateway.log"
$ApiGatewayErr = Join-Path $LogDir "api-gateway-error.log"
$WebSocketLog = Join-Path $LogDir "websocket.log"
$WebSocketErr = Join-Path $LogDir "websocket-error.log"
$FrontendLog = Join-Path $LogDir "frontend.log"
$FrontendErr = Join-Path $LogDir "frontend-error.log"

# 启动日志服务
Write-Host "[日志服务] 正在启动..." -ForegroundColor DarkCyan
$logServiceProcess = Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd '$LogServicePath'; if (Test-Path 'venv\Scripts\Activate.ps1') { . 'venv\Scripts\Activate.ps1' }; python src/main.py" -RedirectStandardOutput $LogServiceLog -RedirectStandardError $LogServiceErr -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

# 启动 API Gateway
Write-Host "[API Gateway] 正在启动..." -ForegroundColor Blue
$apiGatewayProcess = Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd '$ApiGatewayPath'; if (Test-Path 'venv\Scripts\Activate.ps1') { . 'venv\Scripts\Activate.ps1' }; python start.py" -RedirectStandardOutput $ApiGatewayLog -RedirectStandardError $ApiGatewayErr -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

# 启动 WebSocket 服务
Write-Host "[WebSocket] 正在启动..." -ForegroundColor Cyan
$webSocketProcess = Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd '$WebSocketPath'; if (Test-Path 'venv\Scripts\Activate.ps1') { . 'venv\Scripts\Activate.ps1' }; python start.py" -RedirectStandardOutput $WebSocketLog -RedirectStandardError $WebSocketErr -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

# 启动前端
Write-Host "[前端] 正在启动..." -ForegroundColor Magenta
$frontendProcess = Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd '$FrontendPath'; npm run dev" -RedirectStandardOutput $FrontendLog -RedirectStandardError $FrontendErr -PassThru -WindowStyle Hidden

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  所有服务已启动!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "服务状态:" -ForegroundColor Yellow
Write-Host "  - API Gateway: http://localhost:8501" -ForegroundColor White
Write-Host "  - WebSocket:   ws://localhost:8502" -ForegroundColor White
Write-Host "  - 日志服务:    http://localhost:8505" -ForegroundColor White
Write-Host "  - 前端开发:    http://localhost:8500" -ForegroundColor White
Write-Host "  - API 文档:    http://localhost:8501/docs" -ForegroundColor White
Write-Host ""
Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Gray
Write-Host ""

# 等待用户按 Ctrl+C
Write-Host ""
Write-Host "服务正在运行，按 Ctrl+C 停止所有服务..." -ForegroundColor Yellow
try {
    # 使用 Get-Content -Wait 实时显示日志
    $jobs = @()

    $jobs += Start-Job -ScriptBlock {
        param($LogFile)
        Get-Content -Path $LogFile -Wait -Tail 0 | ForEach-Object { "[日志] $_" }
    } -ArgumentList $LogServiceLog

    $jobs += Start-Job -ScriptBlock {
        param($LogFile)
        Get-Content -Path $LogFile -Wait -Tail 0 | ForEach-Object { "[API] $_" }
    } -ArgumentList $ApiGatewayLog

    $jobs += Start-Job -ScriptBlock {
        param($LogFile)
        Get-Content -Path $LogFile -Wait -Tail 0 | ForEach-Object { "[WS] $_" }
    } -ArgumentList $WebSocketLog

    $jobs += Start-Job -ScriptBlock {
        param($LogFile)
        Get-Content -Path $LogFile -Wait -Tail 0 | ForEach-Object { "[前端] $_" }
    } -ArgumentList $FrontendLog

    # 等待并显示输出
    while ($true) {
        foreach ($job in $jobs) {
            if ($job.HasMoreData) {
                $output = Receive-Job -Job $job
                if ($output) {
                    $output | ForEach-Object {
                        if ($_ -match "^\[日志\]") { Write-Host $_ -ForegroundColor DarkCyan }
                        elseif ($_ -match "^\[API\]") { Write-Host $_ -ForegroundColor Blue }
                        elseif ($_ -match "^\[WS\]") { Write-Host $_ -ForegroundColor Cyan }
                        elseif ($_ -match "^\[前端\]") { Write-Host $_ -ForegroundColor Magenta }
                    }
                }
            }
        }
        Start-Sleep -Milliseconds 100
    }
} finally {
    Write-Host ""
    Write-Host "正在停止服务..." -ForegroundColor Red

    # 停止日志监听作业
    foreach ($job in $jobs) {
        Stop-Job -Job $job -ErrorAction SilentlyContinue
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }

    # 停止服务进程及其所有子进程
    function Stop-ProcessTree {
        param([int]$ParentProcessId)
        try {
            # 获取所有子进程
            $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ParentProcessId }
            foreach ($child in $children) {
                Stop-ProcessTree -ParentProcessId $child.ProcessId
            }
            # 停止父进程
            Stop-Process -Id $ParentProcessId -Force -ErrorAction SilentlyContinue
        } catch {}
    }

    if ($logServiceProcess) { Stop-ProcessTree -ParentProcessId $logServiceProcess.Id }
    if ($apiGatewayProcess) { Stop-ProcessTree -ParentProcessId $apiGatewayProcess.Id }
    if ($webSocketProcess) { Stop-ProcessTree -ParentProcessId $webSocketProcess.Id }
    if ($frontendProcess) { Stop-ProcessTree -ParentProcessId $frontendProcess.Id }

    # 额外清理：终止可能残留的 Python 和 Node 进程（通过端口识别）
    $ports = @(8500, 8501, 8502, 8505)
    foreach ($port in $ports) {
        try {
            $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            foreach ($conn in $connections) {
                try {
                    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                } catch {}
            }
        } catch {}
    }

    Write-Host "所有服务已停止" -ForegroundColor Green
}