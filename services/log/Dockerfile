# AIEffect Log Service Dockerfile
FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制共享包
COPY shared/python /shared/python
RUN pip install -e /shared/python

# 复制项目文件
COPY services/log/requirements.txt ./

# 安装依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY services/log/src ./src
COPY services/log/start.py ./

# 设置环境变量
ENV PYTHONPATH=/app/src:/shared/python
ENV PYTHONUNBUFFERED=1

# 暴露端口
EXPOSE 8505

# 启动命令
CMD ["python", "start.py"]
