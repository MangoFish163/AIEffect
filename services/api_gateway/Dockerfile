# AIEffect API Gateway Dockerfile
FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 安装 Poetry
RUN pip install poetry

# 复制共享包
COPY shared/python /shared/python

# 复制项目文件
COPY services/api_gateway/pyproject.toml services/api_gateway/poetry.lock* ./

# 配置 Poetry 并安装依赖
RUN poetry config virtualenvs.create false \
    && poetry install --no-dev --no-interaction --no-ansi

# 复制应用代码
COPY services/api_gateway/src ./src
COPY services/api_gateway/start.py ./

# 设置环境变量
ENV PYTHONPATH=/app/src:/shared/python
ENV PYTHONUNBUFFERED=1

# 暴露端口
EXPOSE 8501

# 启动命令
CMD ["python", "start.py"]
