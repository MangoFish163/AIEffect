#!/usr/bin/env python3
"""日志服务启动脚本"""
import sys
import os

# 设置控制台编码为 UTF-8（Windows 兼容）
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 添加 src 到路径
src_path = os.path.join(os.path.dirname(__file__), "src")
sys.path.insert(0, src_path)

# 设置 PYTHONPATH 环境变量，使相对导入正常工作
os.environ["PYTHONPATH"] = src_path

import uvicorn

if __name__ == "__main__":
    print("Starting Log Service on port 8505...")

    # 使用 import 字符串方式，让 uvicorn 正确加载模块
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8505,
        reload=False,
    )
