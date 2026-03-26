# AIEffect Services

AIEffect 微服务目录，包含所有后端服务。

## 服务列表

| 服务        | 目录           | 端口 | 说明          | 文档                                                     |
| ----------- | -------------- | ---- | ------------- | -------------------------------------------------------- |
| API Gateway | `api_gateway/` | 8501 | 统一 API 入口 | [PROJECT_STRUCTURE.md](api_gateway/PROJECT_STRUCTURE.md) |
| WebSocket   | `websocket/`   | 8502 | 实时通信服务  | [PROJECT_STRUCTURE.md](websocket/PROJECT_STRUCTURE.md)   |
| Log Service | `log/`         | 8505 | 日志收集服务  | [PROJECT_STRUCTURE.md](log/PROJECT_STRUCTURE.md)         |

> **注意**：8500 端口预留给前端服务（Vite 开发服务器）

## 快速开始

### 安装依赖

```bash
# 安装共享包
cd ../shared/python
pip install -e .

# 安装各服务依赖
cd services/api_gateway
poetry install

cd services/websocket
poetry install

cd services/log
poetry install
```

### 启动服务

```bash
# 使用 Make（推荐）
make dev-api        # 启动 API Gateway
make dev-websocket  # 启动 WebSocket
make dev-log        # 启动日志服务

# 或使用 Docker Compose
docker-compose up -d
```

## 架构设计

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│              (React + Vite)                 │
└───────────────────┬─────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌──────────────┐ ┌──────┐ ┌──────────────┐
│ API Gateway  │ │ Web  │ │ Log Service  │
│   (8500)     │ │Socket│ │   (8505)     │
│              │ │(8502)│ │              │
│ - REST API   │ │      │ │ - Collect    │
│ - Proxy      │ │ - Real│ │ - Query      │
│ - Routing    │ │ - Chat│ │ - SSE Stream │
└──────┬───────┘ └──────┘ └──────────────┘
       │
       └───────────────┐
                       ▼
           ┌─────────────────────┐
           │   Shared Core       │
           │   (shared/python)   │
           │                     │
           │ - Config            │
           │ - Database          │
           │ - Logger            │
           │ - Schemas           │
           └─────────────────────┘
```

## 服务间通信

### 1. HTTP 代理

API Gateway 通过 HTTP 代理访问 Log Service：

```python
# api_gateway/api/logs.py
LOG_SERVICE_URL = "http://localhost:8505"

async def _proxy_request(method: str, path: str, ...):
    url = f"{LOG_SERVICE_URL}{path}"
    async with aiohttp.ClientSession() as session:
        ...
```

### 2. 共享包

所有服务通过 `shared_core` 共享代码：

```python
from shared_core import get_config_manager, get_logger, get_db
```

### 3. 数据库访问

- **API Gateway & WebSocket**: 共享主数据库（通过 `shared_core`）
- **Log Service**: 独立数据库（不共享）

## 开发规范

### 1. 新增服务

1. 在 `services/` 下创建新目录
2. 遵循标准结构：
   ```
   services/new_service/
   ├── src/new_service/
   │   ├── __init__.py
   │   ├── main.py
   │   └── ...
   ├── Dockerfile
   ├── pyproject.toml
   ├── start.py
   └── PROJECT_STRUCTURE.md
   ```
3. 使用 `shared_core` 共享包
4. 添加 Dockerfile
5. 更新 `docker-compose.yml`
6. 创建 `PROJECT_STRUCTURE.md`

### 2. 代码规范

- 使用 `shared_core` 的配置、日志、数据库
- 不要直接访问其他服务的数据库
- 服务间通信使用 HTTP API
- 所有 API 返回 `BaseResponse` 格式

### 3. 端口分配

| 端口 | 服务        | 说明                  |
| ---- | ----------- | --------------------- |
| 8500 | 前端服务    | Vite 开发服务器       |
| 8501 | API Gateway | FastAPI 主服务        |
| 8502 | WebSocket   | WebSocket 服务        |
| 8503 | （保留）    | 字幕服务（未来）      |
| 8504 | （保留）    | TTS 服务（未来）      |
| 8505 | Log Service | 日志服务              |

## 文档索引

- [API Gateway 结构](api_gateway/PROJECT_STRUCTURE.md)
- [WebSocket 结构](websocket/PROJECT_STRUCTURE.md)
- [Log Service 结构](log/PROJECT_STRUCTURE.md)
- [架构重构迁移设计](../架构重构迁移设计.md)
- [共享包文档](../shared/python/README.md)
