#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AIEffect 开发环境一键启动脚本
同时启动前端和后端开发服务器

用法:
    python script/start-dev.py           # 直接启动服务（跳过依赖安装）
    python script/start-dev.py --init    # 初始化模式：创建虚拟环境并安装所有依赖
    python script/start-dev.py --help    # 显示帮助信息
"""

import argparse
import os
import sys
import subprocess
import signal
import time
import json
from pathlib import Path
from datetime import datetime

# 进程管理
processes = []
jobs = []


def log(message, color=None):
    """打印带颜色的日志"""
    colors = {
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'magenta': '\033[95m',
        'cyan': '\033[96m',
        'gray': '\033[90m',
        'reset': '\033[0m'
    }
    if color and color in colors:
        print(f"{colors[color]}{message}{colors['reset']}")
    else:
        print(message)


def check_command(cmd):
    """检查命令是否存在"""
    try:
        subprocess.run([cmd, '--version'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def get_version(cmd):
    """获取命令版本"""
    try:
        result = subprocess.run([cmd, '--version'], capture_output=True, text=True)
        return result.stdout.strip() or result.stderr.strip()
    except:
        return "未知版本"


def run_command(cmd, cwd=None, env=None, capture_output=False):
    """运行命令"""
    try:
        if capture_output:
            result = subprocess.run(cmd, shell=True, cwd=cwd, env=env, capture_output=True, text=True)
            return result.returncode == 0, result.stdout, result.stderr
        else:
            subprocess.run(cmd, shell=True, cwd=cwd, env=env, check=True)
            return True, None, None
    except subprocess.CalledProcessError as e:
        return False, None, str(e)


def start_process(cmd, cwd=None, env=None, stdout=None, stderr=None):
    """启动后台进程"""
    try:
        if stdout and stderr:
            proc = subprocess.Popen(
                cmd,
                shell=True,
                cwd=cwd,
                env=env,
                stdout=open(stdout, 'w'),
                stderr=open(stderr, 'w'),
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0
            )
        else:
            proc = subprocess.Popen(
                cmd,
                shell=True,
                cwd=cwd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0
            )
        processes.append(proc)
        return proc
    except Exception as e:
        log(f"启动进程失败: {e}", 'red')
        return None


def stop_all_services():
    """停止所有服务"""
    log("\n正在停止服务...", 'red')
    
    # 停止所有进程
    for proc in processes:
        try:
            if sys.platform == 'win32':
                # Windows: 使用 taskkill 终止进程树
                subprocess.run(f'taskkill /F /T /PID {proc.pid}', shell=True, capture_output=True)
            else:
                # Linux/Mac: 使用进程组终止
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except:
                try:
                    proc.kill()
                except:
                    pass
    
    # 额外清理：终止可能残留的 Python 和 Node 进程（通过端口识别）
    ports = [8500, 8501, 8502, 8505]
    for port in ports:
        try:
            if sys.platform == 'win32':
                # 查找占用端口的进程
                result = subprocess.run(
                    f'netstat -ano | findstr :{port}',
                    shell=True, capture_output=True, text=True
                )
                if result.stdout:
                    for line in result.stdout.strip().split('\n'):
                        parts = line.strip().split()
                        if len(parts) >= 5:
                            pid = parts[-1]
                            subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
            else:
                # Linux/Mac
                result = subprocess.run(
                    f'lsof -ti:{port}',
                    shell=True, capture_output=True, text=True
                )
                if result.stdout:
                    for pid in result.stdout.strip().split('\n'):
                        if pid:
                            subprocess.run(f'kill -9 {pid}', shell=True, capture_output=True)
        except:
            pass
    
    log("所有服务已停止", 'green')


def signal_handler(sig, frame):
    """信号处理"""
    stop_all_services()
    sys.exit(0)


def init_environment(project_root):
    """初始化环境"""
    log("【初始化模式】正在安装/更新所有依赖...", 'yellow')
    log("")
    
    paths = {
        'api_gateway': project_root / 'services' / 'api_gateway',
        'websocket': project_root / 'services' / 'websocket',
        'log': project_root / 'services' / 'log',
        'shared': project_root / 'shared' / 'python',
        'frontend': project_root / 'frontend'
    }
    
    # 安装共享核心包
    log("安装共享核心包...", 'yellow')
    os.chdir(paths['shared'])
    success, _, error = run_command('pip install -e . -q', capture_output=True)
    if success:
        log("共享核心包安装完成", 'green')
    else:
        log(f"共享核心包安装失败: {error}", 'red')
    
    # 安装 API Gateway 依赖
    log("")
    log("检查 API Gateway 依赖...", 'yellow')
    os.chdir(paths['api_gateway'])
    if not (paths['api_gateway'] / 'venv').exists():
        log("  创建虚拟环境...", 'gray')
        run_command('python -m venv venv')
    
    venv_activate = paths['api_gateway'] / 'venv' / 'Scripts' / 'activate.bat'
    if sys.platform != 'win32':
        venv_activate = paths['api_gateway'] / 'venv' / 'bin' / 'activate'
    
    if venv_activate.exists():
        log("  安装 Python 依赖...", 'gray')
        if sys.platform == 'win32':
            run_command(f'{venv_activate} && pip install -r requirements.txt -q')
        else:
            run_command(f'source {venv_activate} && pip install -r requirements.txt -q')
        log("API Gateway 依赖就绪", 'green')
    
    # 安装 WebSocket 服务依赖
    log("")
    log("检查 WebSocket 服务依赖...", 'yellow')
    os.chdir(paths['websocket'])
    if not (paths['websocket'] / 'venv').exists():
        log("  创建虚拟环境...", 'gray')
        run_command('python -m venv venv')
    
    venv_activate = paths['websocket'] / 'venv' / 'Scripts' / 'activate.bat'
    if sys.platform != 'win32':
        venv_activate = paths['websocket'] / 'venv' / 'bin' / 'activate'
    
    if venv_activate.exists():
        log("  安装 Python 依赖...", 'gray')
        if sys.platform == 'win32':
            run_command(f'{venv_activate} && pip install -r requirements.txt -q')
        else:
            run_command(f'source {venv_activate} && pip install -r requirements.txt -q')
        log("WebSocket 服务依赖就绪", 'green')
    
    # 安装日志服务依赖
    log("")
    log("检查日志服务依赖...", 'yellow')
    os.chdir(paths['log'])
    if not (paths['log'] / 'venv').exists():
        log("  创建虚拟环境...", 'gray')
        run_command('python -m venv venv')
    
    venv_activate = paths['log'] / 'venv' / 'Scripts' / 'activate.bat'
    if sys.platform != 'win32':
        venv_activate = paths['log'] / 'venv' / 'bin' / 'activate'
    
    if venv_activate.exists():
        log("  安装 Python 依赖...", 'gray')
        if sys.platform == 'win32':
            run_command(f'{venv_activate} && pip install -r requirements.txt -q')
        else:
            run_command(f'source {venv_activate} && pip install -r requirements.txt -q')
        log("日志服务依赖就绪", 'green')
    
    # 安装前端依赖
    log("")
    log("检查前端依赖...", 'yellow')
    os.chdir(paths['frontend'])
    if not (paths['frontend'] / 'node_modules').exists():
        log("  安装 npm 依赖...", 'gray')
        run_command('npm install')
    else:
        log("  更新 npm 依赖...", 'gray')
        run_command('npm install')
    log("前端依赖就绪", 'green')
    
    log("")
    log("==========================================", 'green')
    log("  依赖安装完成!", 'green')
    log("==========================================", 'green')
    log("")


def check_environment(project_root):
    """检查环境"""
    log("【快速启动模式】跳过依赖安装...", 'gray')
    log("")
    
    paths = {
        'api_gateway': project_root / 'services' / 'api_gateway',
        'websocket': project_root / 'services' / 'websocket',
        'log': project_root / 'services' / 'log',
        'frontend': project_root / 'frontend'
    }
    
    missing_env = False
    
    if not (paths['api_gateway'] / 'venv').exists():
        log("[警告] API Gateway 虚拟环境不存在，请使用 --init 参数初始化", 'red')
        missing_env = True
    
    if not (paths['websocket'] / 'venv').exists():
        log("[警告] WebSocket 虚拟环境不存在，请使用 --init 参数初始化", 'red')
        missing_env = True
    
    if not (paths['log'] / 'venv').exists():
        log("[警告] 日志服务虚拟环境不存在，请使用 --init 参数初始化", 'red')
        missing_env = True
    
    if not (paths['frontend'] / 'node_modules').exists():
        log("[警告] 前端 node_modules 不存在，请使用 --init 参数初始化", 'red')
        missing_env = True
    
    if missing_env:
        log("")
        log("首次运行或环境缺失，请执行:", 'yellow')
        log("  python script/start-dev.py --init", 'cyan')
        log("")
        sys.exit(1)
    
    log("环境检查通过，准备启动服务...", 'green')
    log("")


def start_services(project_root, log_dir):
    """启动所有服务"""
    paths = {
        'api_gateway': project_root / 'services' / 'api_gateway',
        'websocket': project_root / 'services' / 'websocket',
        'log': project_root / 'services' / 'log',
        'frontend': project_root / 'frontend'
    }
    
    log_files = {
        'log_service': (log_dir / 'log-service.log', log_dir / 'log-service-error.log'),
        'api_gateway': (log_dir / 'api-gateway.log', log_dir / 'api-gateway-error.log'),
        'websocket': (log_dir / 'websocket.log', log_dir / 'websocket-error.log'),
        'frontend': (log_dir / 'frontend.log', log_dir / 'frontend-error.log')
    }
    
    log("启动服务...", 'cyan')
    log("")
    
    # 启动日志服务
    log("[日志服务] 正在启动...", 'cyan')
    log_service_path = paths['log']
    venv_activate = log_service_path / 'venv' / 'Scripts' / 'activate.bat'
    if sys.platform != 'win32':
        venv_activate = log_service_path / 'venv' / 'bin' / 'activate'
    
    if sys.platform == 'win32':
        cmd = f'cd /d "{log_service_path}" && {venv_activate} && python src/main.py'
    else:
        cmd = f'cd "{log_service_path}" && source {venv_activate} && python src/main.py'
    
    start_process(cmd, stdout=log_files['log_service'][0], stderr=log_files['log_service'][1])
    time.sleep(2)
    
    # 启动 API Gateway
    log("[API Gateway] 正在启动...", 'blue')
    api_gateway_path = paths['api_gateway']
    venv_activate = api_gateway_path / 'venv' / 'Scripts' / 'activate.bat'
    if sys.platform != 'win32':
        venv_activate = api_gateway_path / 'venv' / 'bin' / 'activate'
    
    if sys.platform == 'win32':
        cmd = f'cd /d "{api_gateway_path}" && {venv_activate} && python start.py'
    else:
        cmd = f'cd "{api_gateway_path}" && source {venv_activate} && python start.py'
    
    start_process(cmd, stdout=log_files['api_gateway'][0], stderr=log_files['api_gateway'][1])
    time.sleep(2)
    
    # 启动 WebSocket 服务
    log("[WebSocket] 正在启动...", 'cyan')
    websocket_path = paths['websocket']
    venv_activate = websocket_path / 'venv' / 'Scripts' / 'activate.bat'
    if sys.platform != 'win32':
        venv_activate = websocket_path / 'venv' / 'bin' / 'activate'
    
    if sys.platform == 'win32':
        cmd = f'cd /d "{websocket_path}" && {venv_activate} && python start.py'
    else:
        cmd = f'cd "{websocket_path}" && source {venv_activate} && python start.py'
    
    start_process(cmd, stdout=log_files['websocket'][0], stderr=log_files['websocket'][1])
    time.sleep(2)
    
    # 启动前端
    log("[前端] 正在启动...", 'magenta')
    frontend_path = paths['frontend']
    
    if sys.platform == 'win32':
        cmd = f'cd /d "{frontend_path}" && npm run dev'
    else:
        cmd = f'cd "{frontend_path}" && npm run dev'
    
    start_process(cmd, stdout=log_files['frontend'][0], stderr=log_files['frontend'][1])
    
    log("")
    log("==========================================", 'green')
    log("  所有服务已启动!", 'green')
    log("==========================================", 'green')
    log("")
    log("服务状态:", 'yellow')
    log("  - API Gateway: http://localhost:8501", 'white')
    log("  - WebSocket:   ws://localhost:8502", 'white')
    log("  - 日志服务:    http://localhost:8505", 'white')
    log("  - 前端开发:    http://localhost:8500", 'white')
    log("  - API 文档:    http://localhost:8501/docs", 'white')
    log("")
    log("按 Ctrl+C 停止所有服务", 'gray')
    log("")


def tail_log(log_file, prefix, color):
    """实时显示日志"""
    try:
        with open(log_file, 'r') as f:
            # 移动到文件末尾
            f.seek(0, 2)
            while True:
                line = f.readline()
                if line:
                    log(f"[{prefix}] {line.strip()}", color)
                else:
                    time.sleep(0.1)
    except:
        pass


def main():
    parser = argparse.ArgumentParser(description='AIEffect 开发环境启动脚本')
    parser.add_argument('--init', action='store_true', help='初始化模式：创建虚拟环境并安装所有依赖')
    args = parser.parse_args()
    
    # 设置信号处理
    signal.signal(signal.SIGINT, signal_handler)
    if sys.platform != 'win32':
        signal.signal(signal.SIGTERM, signal_handler)
    
    # 获取项目根目录
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent
    
    log("==========================================", 'cyan')
    if args.init:
        log("  AIEffect - 开发环境初始化并启动", 'cyan')
    else:
        log("  AIEffect - 开发环境启动", 'cyan')
    log("==========================================", 'cyan')
    log("")
    
    # 检查 Python
    if check_command('python') or check_command('python3'):
        version = get_version('python') or get_version('python3')
        log(f"Python: {version}", 'green')
    else:
        log("错误: 未找到 Python，请先安装 Python 3.12+", 'red')
        sys.exit(1)
    
    # 检查 Node.js
    if check_command('node'):
        version = get_version('node')
        log(f"Node.js: {version}", 'green')
    else:
        log("错误: 未找到 Node.js，请先安装 Node.js", 'red')
        sys.exit(1)
    
    log("")
    
    # 创建日志目录
    log_dir = project_root / 'logs'
    log_dir.mkdir(exist_ok=True)
    
    # 创建数据目录
    data_dir = project_root / 'data'
    data_dir.mkdir(exist_ok=True)
    
    # 依赖安装/检查阶段
    if args.init:
        init_environment(project_root)
    else:
        check_environment(project_root)
    
    # 启动服务
    start_services(project_root, log_dir)
    
    # 等待用户按 Ctrl+C
    log("")
    log("服务正在运行，按 Ctrl+C 停止所有服务...", 'yellow')
    
    try:
        # 启动日志监控线程
        import threading
        
        log_configs = [
            (log_dir / 'log-service.log', '日志', 'cyan'),
            (log_dir / 'api-gateway.log', 'API', 'blue'),
            (log_dir / 'websocket.log', 'WS', 'cyan'),
            (log_dir / 'frontend.log', '前端', 'magenta')
        ]
        
        threads = []
        for log_file, prefix, color in log_configs:
            if log_file.exists():
                t = threading.Thread(target=tail_log, args=(log_file, prefix, color))
                t.daemon = True
                t.start()
                threads.append(t)
        
        # 主循环
        while True:
            time.sleep(1)
            # 检查进程是否还在运行
            for proc in processes[:]:
                if proc.poll() is not None:
                    processes.remove(proc)
    except KeyboardInterrupt:
        stop_all_services()


if __name__ == '__main__':
    main()
