#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AIEffect Service Manager 启动脚本
使用 Python 实现的服务生命周期管理器

用法:
  python start_services.py              # 启动所有服务
  python start_services.py --status     # 查看服务状态
  python start_services.py --stop       # 停止所有服务
  python start_services.py --build      # 构建服务管理器
  python start_services.py --help       # 显示帮助
"""

import argparse
import subprocess
import sys
import os
from pathlib import Path
from datetime import datetime, timezone


def print_colored(text: str, color: str = "white") -> None:
    """打印带颜色的文本"""
    colors = {
        "cyan": "\033[36m",
        "yellow": "\033[33m",
        "green": "\033[32m",
        "red": "\033[31m",
        "gray": "\033[90m",
        "white": "\033[0m",
    }
    reset = "\033[0m"
    print(f"{colors.get(color, '')}{text}{reset}")


def print_header() -> None:
    """打印标题"""
    print_colored("==========================================", "cyan")
    print_colored("  AIEffect - 服务生命周期管理器", "cyan")
    print_colored("==========================================", "cyan")
    print()


def print_help() -> None:
    """打印帮助信息"""
    print_header()
    print_colored("用法:", "yellow")
    print_colored("  python start_services.py              启动所有服务", "white")
    print_colored("  python start_services.py --status     查看服务状态", "white")
    print_colored("  python start_services.py --stop       停止所有服务", "white")
    print_colored("  python start_services.py --build      构建服务管理器", "white")
    print_colored("  python start_services.py --dev        开发模式（启动前端）", "white")
    print_colored("  python start_services.py --help       显示此帮助信息", "white")
    print()
    print_colored("说明:", "yellow")
    print_colored("  - 此脚本使用 Rust 实现的服务管理器替代了原来的 PowerShell 脚本", "gray")
    print_colored("  - 支持优雅关闭、健康检查、自动重启等功能", "gray")
    print_colored("  - 需要先安装 Rust 工具链才能构建", "gray")
    print()


def check_rust_installed() -> bool:
    """检查 Rust 是否已安装"""
    try:
        result = subprocess.run(
            ["rustc", "--version"],
            capture_output=True,
            text=True,
            check=True,
            shell=True
        )
        print_colored(f"Rust: {result.stdout.strip()}", "green")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def build_service_manager(project_root: Path, force: bool = False) -> None:
    """构建服务管理器
    
    Args:
        project_root: 项目根目录
        force: 是否强制重新构建
    """
    print_colored("正在构建服务管理器...", "yellow")

    if not check_rust_installed():
        print_colored("错误: 未找到 Rust，请先安装 Rust 工具链", "red")
        print_colored("访问 https://rustup.rs/ 安装 Rust", "gray")
        sys.exit(1)

    service_manager_dir = project_root / "service-manager"
    if not service_manager_dir.exists():
        print_colored(f"错误: 服务管理器目录不存在: {service_manager_dir}", "red")
        sys.exit(1)
    exe_path = service_manager_dir / "target" / "release" / "service-manager.exe"

    # 检查是否已构建且不需要强制重新构建
    if exe_path.exists() and not force:
        print_colored("服务管理器已存在，跳过构建", "green")
        print_colored("使用 --build 参数强制重新构建", "gray")
        return

    # 构建前清理旧的可执行文件
    if force and exe_path.exists():
        try:
            exe_path.unlink()
            print_colored("已清理旧的可执行文件", "gray")
        except Exception as e:
            print_colored(f"清理旧文件失败: {e}", "yellow")

    print_colored("开始构建，这可能需要几分钟...", "yellow")
    
    # 创建构建日志目录
    log_dir = project_root / "logs"
    log_dir.mkdir(exist_ok=True)
    build_log_path = log_dir / f"build_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.log"
    
    try:
        # 使用详细输出模式，便于调试
        print_colored(f"构建日志将保存到: {build_log_path}", "gray")
        
        with open(build_log_path, "w", encoding="utf-8") as log_file:
            # 使用Popen实时捕获输出
            process = subprocess.Popen(
                ["cargo", "build", "--release", "--verbose"],
                cwd=service_manager_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                shell=True
            )
            
            # 实时读取输出并写入日志
            build_output = ""
            for line in process.stdout:
                build_output += line
                log_file.write(line)
                log_file.flush()
                
                # 实时显示错误和警告（更精确的匹配）
                line_lower = line.lower()
                # 只匹配真正的编译错误 (error[E...] 或 error: 开头)
                if line_lower.startswith("error[") or line_lower.startswith("error:"):
                    print_colored(f"构建错误: {line.strip()}", "red")
                # 匹配警告 (warning: 开头)
                elif line_lower.startswith("warning:"):
                    print_colored(f"构建警告: {line.strip()}", "yellow")
            
            # 等待进程结束并检查返回码
            return_code = process.wait()
            if return_code != 0:
                raise subprocess.CalledProcessError(return_code, process.args, output=build_output)

    except FileNotFoundError:
        print_colored("错误: 未找到 cargo，请先安装 Rust 工具链", "red")
        print_colored("访问 https://rustup.rs/ 安装 Rust", "gray")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print_colored(f"构建失败，退出码: {e.returncode}", "red")
        
        # 尝试读取构建日志提供更多信息
        if build_log_path.exists():
            try:
                with open(build_log_path, "r", encoding="utf-8") as log_file:
                    log_content = log_file.read()
                    # 提取最后100行错误信息
                    lines = log_content.split('\n')
                    error_lines = [line for line in lines if "error" in line.lower()]
                    if error_lines:
                        print_colored("构建错误详情:", "red")
                        for error_line in error_lines[-10:]:  # 显示最后10个错误
                            print_colored(f"  {error_line}", "red")
            except Exception as e:
                print_colored(f"读取构建日志失败: {e}", "yellow")
        else:
            print_colored(f"详细错误信息请查看: {build_log_path}", "gray")
        
        print_colored("可能的解决方案:", "yellow")
        print_colored("1. 检查 Rust 版本: rustc --version", "gray")
        print_colored("2. 更新 Rust: rustup update", "gray")
        print_colored("3. 清理构建缓存: cargo clean", "gray")
        print_colored("4. 检查依赖: cargo check", "gray")
        
        sys.exit(1)
    except Exception as e:
        print_colored(f"构建过程中发生未知错误: {e}", "red")
        sys.exit(1)

    if not exe_path.exists():
        print_colored(f"错误: 构建完成但未找到可执行文件: {exe_path}", "red")
        print_colored(f"请检查构建日志: {build_log_path}", "gray")
        sys.exit(1)
    
    print_colored("✅ 服务管理器构建成功", "green")


def get_service_manager_path(project_root: Path) -> Path:
    """获取服务管理器可执行文件路径"""
    return project_root / "service-manager" / "target" / "release" / "service-manager.exe"


def start_frontend(project_root: Path) -> subprocess.Popen:
    """启动前端服务（Vite + React，默认端口8500）"""
    frontend_dir = project_root / "frontend"
    if not frontend_dir.exists():
        print_colored(f"错误: 前端目录不存在: {frontend_dir}", "red")
        sys.exit(1)
    
    # 检查端口8500是否可用
    if not is_port_available(8500):
        print_colored(f"错误: 前端端口 8500 已被占用，请释放后重试", "red")
        sys.exit(1)
    
    print_colored("🚀 启动前端服务（端口8500）...", "cyan")
    try:
        # 非阻塞方式启动前端，后台运行
        frontend_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            shell=True
        )
        print_colored("✅ 前端服务已启动，访问 http://localhost:8500", "green")
        return frontend_process
    except FileNotFoundError:
        print_colored("❌ 未找到npm，请先安装Node.js", "red")
        sys.exit(1)
    except Exception as e:
        print_colored(f"❌ 前端启动失败: {e}", "red")
        sys.exit(1)

def run_service_manager(project_root: Path, command: str, frontend_process: subprocess.Popen = None) -> None:
    """运行服务管理器命令"""
    exe_path = get_service_manager_path(project_root)

    if not exe_path.exists():
        print_colored("服务管理器未找到，正在构建...", "yellow")
        build_service_manager(project_root)
        if not exe_path.exists():
            print_colored(f"错误: 服务管理器可执行文件仍不存在: {exe_path}", "red")
            if frontend_process:
                frontend_process.terminate()
            sys.exit(1)

    cmd = [str(exe_path), "--project-root", str(project_root), command]

    process = None
    try:
        print_colored("正在启动服务管理器...", "cyan")
        # 使用 os.system 让服务管理器在前台运行，直接接收信号
        # 这样 Ctrl+C 会直接发送给服务管理器进程
        exit_code = os.system(' '.join(cmd))
        
        if exit_code != 0:
            print_colored(f"服务管理器退出，退出码: {exit_code}", "yellow")
        
    except FileNotFoundError:
        print_colored(f"错误: 无法执行服务管理器: {exe_path}", "red")
        if frontend_process:
            frontend_process.terminate()
        sys.exit(1)
    except KeyboardInterrupt:
        # 注意：如果使用 os.system，Ctrl+C 会被子进程捕获，这里可能不会触发
        # 但我们还是保留这个处理作为备用
        print_colored("\n正在停止服务...", "yellow")
        
        # 停止前端服务
        if frontend_process:
            print_colored("正在关闭前端服务...", "gray")
            try:
                frontend_process.terminate()
                try:
                    frontend_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    frontend_process.kill()
            except Exception as e:
                print_colored(f"关闭前端服务时出错: {e}", "yellow")
        
        print_colored("✅ 所有服务已停止", "green")
        sys.exit(0)


import socket

def is_port_available(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            s.connect(("localhost", port))
        return False
    except (socket.timeout, ConnectionRefusedError):
        return True

def start_services(project_root: Path) -> None:
    """启动所有服务（包括前端）"""
    print_colored("启动所有服务...", "green")
    print()
    print_colored("服务列表:", "yellow")
    print_colored("  - Frontend:       http://localhost:8500", "white")
    print_colored("  - API Gateway:    http://localhost:8501", "white")
    print_colored("  - WebSocket:      ws://localhost:8502", "white")
    print_colored("  - Log Service:    http://localhost:8505", "white")
    print()
    print_colored("按 Ctrl+C 停止所有服务", "gray")
    print()

    # 检查必要端口是否可用
    required_ports = [8500, 8501, 8502, 8505]
    for port in required_ports:
        if not is_port_available(port):
            print_colored(f"错误: 端口 {port} 已被占用，请释放后重试", "red")
            # 尝试终止所有相关进程
            try:
                import subprocess
                # 终止所有可能占用端口的进程
                subprocess.run(["taskkill", "/F", "/IM", "python.exe", "/IM", "node.exe", "/IM", "service-manager.exe"], shell=True, capture_output=True)
                print("已终止所有可能占用端口的进程")
            except Exception as e:
                print(f"终止进程失败: {e}")
            sys.exit(1)

    # 先启动前端服务
    frontend_process = start_frontend(project_root)
    
    # 再启动后端服务（通过服务管理器）
    run_service_manager(project_root, "start", frontend_process)


def main() -> None:
    """主函数"""
    parser = argparse.ArgumentParser(
        description="AIEffect 服务生命周期管理器",
        add_help=False
    )
    parser.add_argument("--status", action="store_true", help="查看服务状态")
    parser.add_argument("--stop", action="store_true", help="停止所有服务")
    parser.add_argument("--build", action="store_true", help="构建服务管理器")
    parser.add_argument("--dev", action="store_true", help="开发模式（启动前端）")
    parser.add_argument("--help", "-h", action="store_true", help="显示帮助信息")

    args = parser.parse_args()

    if args.help:
        print_help()
        sys.exit(0)

    # 设置项目根目录
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent

    print_header()

    if args.build:
        build_service_manager(project_root, force=True)
        sys.exit(0)

    if args.status:
        print_colored("查看服务状态...", "cyan")
        run_service_manager(project_root, "status")
    elif args.stop:
        print_colored("停止所有服务...", "red")
        run_service_manager(project_root, "stop")
    elif args.dev:
        print_colored("🔧 启动开发模式（前后端）...", "cyan")
        # 先启动前端服务
        frontend_process = start_frontend(project_root)
        # 再启动后端服务
        run_service_manager(project_root, "dev", frontend_process)
    else:
        start_services(project_root)


if __name__ == "__main__":
    main()
