# AIEffect 项目 Makefile
.PHONY: help install dev build up down restart logs clean

# 默认目标
help:
	@echo "AIEffect 项目管理命令"
	@echo ""
	@echo "安装命令:"
	@echo "  make install         - 安装所有服务的依赖"
	@echo "  make install-shared  - 安装共享包"
	@echo ""
	@echo "开发命令:"
	@echo "  make dev-api         - 启动 API Gateway 开发服务器"
	@echo "  make dev-websocket   - 启动 WebSocket 服务开发服务器"
	@echo "  make dev-log         - 启动日志服务开发服务器"
	@echo ""
	@echo "Docker 命令:"
	@echo "  make build           - 构建所有 Docker 镜像"
	@echo "  make up              - 启动所有服务 (docker-compose up)"
	@echo "  make down            - 停止所有服务 (docker-compose down)"
	@echo "  make restart         - 重启所有服务"
	@echo "  make logs            - 查看所有服务日志"
	@echo ""
	@echo "其他命令:"
	@echo "  make clean           - 清理临时文件和缓存"
	@echo "  make test            - 运行测试"

# 安装共享包
install-shared:
	cd shared/python && pip install -e .

# 安装所有服务依赖
install: install-shared
	cd services/api_gateway && poetry install
	cd services/websocket && poetry install
	cd services/log && poetry install

# 开发服务器
dev-api:
	cd services/api_gateway && python start.py

dev-websocket:
	cd services/websocket && python start.py

dev-log:
	cd services/log && python start.py

# 启动所有服务（需要 tmux 或单独终端窗口）
dev-all:
	@echo "启动所有服务..."
	@echo "请确保已安装共享包: make install-shared"
	@make dev-log &
	@sleep 2
	@make dev-api &
	@sleep 2
	@make dev-websocket &
	@echo "所有服务已启动"
	@echo "- API Gateway: http://localhost:8501"
	@echo "- WebSocket:   ws://localhost:8502"
	@echo "- Log Service: http://localhost:8505"

# Docker 命令
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

# 清理
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

# 测试
test:
	cd services/api_gateway && pytest
	cd services/websocket && pytest
	cd services/log && pytest
