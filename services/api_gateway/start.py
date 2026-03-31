#!/usr/bin/env python3
"""API Gateway 启动脚本"""
import sys
import os

# 设置控制台编码为 UTF-8（Windows 兼容）
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 添加 src 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

# 添加共享包到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared", "python"))

from api_gateway.main import app
import uvicorn
from shared_core import get_config_manager

if __name__ == "__main__":
    config_manager = get_config_manager()
    port = config_manager.config.ports.api
    host = "0.0.0.0" if config_manager.config.lan_enabled else "127.0.0.1"

    print(f"Starting API Gateway on {host}:{port}...")

    uvicorn.run(
        "api_gateway.main:app",
        host=host,
        port=port,
        reload=False,
    )
