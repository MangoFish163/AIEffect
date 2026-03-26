#!/usr/bin/env python3
"""日志服务启动脚本"""
import sys
import os

# 添加 src 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

import uvicorn

if __name__ == "__main__":
    print("Starting Log Service on port 8505...")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8505,
        reload=False,
    )
