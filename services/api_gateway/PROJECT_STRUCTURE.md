# AIEffect API Gateway 项目结构文档

## 项目概述

API Gateway 是 AIEffect 的统一 API 入口，负责：
- REST API 路由和请求处理
- 向后端微服务（日志服务）代理请求
- 业务逻辑处理（TTS、字幕、记忆管理等）
- 统一的认证和鉴权（未来扩展）

**注意**：此服务由 `backend/` 目录重构而来，原 `backend/` 目录已归档。

---

## 目录结构

```
services/api_gateway/
├── Dockerfile                    # Docker 镜像构建配置
├── PROJECT_STRUCTURE.md          # 本文档
├── README.md                     # 服务说明文档
├── pyproject.toml                # Poetry 依赖管理
├── requirements.txt              # pip 依赖（备选）
├── start.py                      # 服务启动脚本
└── src/
    └── api_gateway/
        ├── __init__.py           # 包初始化
        ├── main.py               # FastAPI 应用入口
        ├── api/                  # API 路由层
        │   ├── __init__.py       # 路由聚合
        │   ├── agents.py         # AI 代理管理接口
        │   ├── ai_assistant.py   # AI 助手接口
        │   ├── asr.py            # 语音识别接口
        │   ├── characters.py     # 游戏角色管理接口
        │   ├── config.py         # 系统配置管理接口
        │   ├── files.py          # 文件浏览管理接口
        │   ├── logs.py           # 日志服务代理接口
        │   ├── memory.py         # 角色记忆管理接口
        │   ├── providers.py      # AI 服务商预设管理接口
        │   ├── proxy.py          # Ollama 代理服务接口
        │   ├── subtitle.py       # 字幕服务接口
        │   ├── system.py         # 系统信息与健康检查接口
        │   └── tts.py            # 语音合成接口
        ├── models/               # 数据模型层
        │   ├── __init__.py
        │   └── schemas.py        # Pydantic 数据模型
        └── services/             # 业务服务层
            ├── __init__.py
            ├── log_service.py    # 日志服务封装
            ├── memory_service.py # 记忆管理服务
            ├── proxy_service.py  # 代理服务实现
            ├── subtitle_service.py # 字幕服务实现
            └── tts_service.py    # TTS 服务实现
```

---

## 核心设计原则

### 1. 依赖共享包

所有服务共享 `shared_core` 包：

```python
# ✅ 正确：使用共享包
from shared_core import get_config_manager, get_logger, get_db
from shared_core import BaseResponse, Message

# ❌ 错误：本地相对导入（除非是本服务特有模块）
from ..core.config import get_config_manager  # 已移除
```

### 2. 服务代理模式

日志服务已独立，API Gateway 通过代理访问：

```python
# api/logs.py
LOG_SERVICE_URL = "http://localhost:8505"

async def _proxy_request(method: str, path: str, ...):
    """代理请求到日志服务"""
    url = f"{LOG_SERVICE_URL}{path}"
    async with aiohttp.ClientSession() as session:
        ...
```

### 3. 数据库访问

- **主数据库**：通过 `shared_core.get_db()` 访问
- **日志数据库**：通过日志服务 API 访问（不直接连接）

---

## 文件功能详解

### main.py

**FastAPI 应用主入口**

- 创建 FastAPI 应用实例
- 配置 CORS 跨域支持
- 注册所有 API 路由
- 应用生命周期管理（启动/关闭）
- 健康检查端点 `/api/health`

**关键变更**：
- 使用 `shared_core` 替代本地 `core` 模块
- 移除 WebSocket 相关代码（已迁移到独立服务）

### api/logs.py

**日志服务代理层**

- 所有 `/api/logs/*` 请求代理到日志服务（端口 8505）
- 日志服务不可用时返回降级数据
- 支持 SSE 流式日志转发

```python
@router.get("", response_model=BaseResponse)
async def get_logs(...):
    """获取日志列表（代理到日志服务）"""
    result = await _proxy_request("GET", "/logs", params=params)
    if result is None:
        # 降级处理：返回空数据
        return BaseResponse(data={"items": [], "total": 0, ...})
```

### 其他 API 文件

功能与原 `backend/src/api/` 保持一致，但导入路径更新为使用 `shared_core`。

---

## 技术栈

| 组件 | 用途 | 版本 |
|------|------|------|
| FastAPI | Web 框架 | ^0.104.0 |
| Uvicorn | ASGI 服务器 | ^0.24.0 |
| Pydantic | 数据验证 | ^2.5.0 |
| aiohttp | HTTP 客户端（代理用） | ^3.9.0 |
| shared_core | 共享核心模块 | 本地路径 |

---

## 端口与服务发现

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| Frontend | 8500 | 前端服务（Vite 开发服务器）|
| API Gateway | 8501 | 本服务端口 |
| WebSocket | 8502 | WebSocket 服务（前端直接连接）|
| Log Service | 8505 | 日志服务地址 |

**环境变量**：
```bash
LOG_SERVICE_URL=http://localhost:8505  # 日志服务地址
```

---

## 开发规范

### 1. 新增 API 路由

1. 在 `api/` 目录下创建新文件
2. 使用 `shared_core` 的模型和工具
3. 在 `api/__init__.py` 中导出
4. 在 `main.py` 中注册路由

### 2. 服务间调用

- **HTTP 调用**：使用 `aiohttp` 或 `httpx`
- **共享数据**：通过 `shared_core` 访问同一数据库
- **避免**：直接访问其他服务的数据库文件

### 3. 错误处理

```python
from shared_core import get_logger

logger = get_logger(__name__)

try:
    result = await some_operation()
except Exception as e:
    logger.error(f"Operation failed: {e}")
    raise HTTPException(status_code=500, detail="Internal error")
```

---

## 与原 backend/ 的差异

| 项目 | 原 backend/ | 新 api_gateway/ |
|------|-------------|-----------------|
| 位置 | `backend/` | `services/api_gateway/` |
| 端口 | 8501 | 8501 |
| WebSocket | 内嵌 | 已移除（独立服务）|
| 核心模块 | `src/core/` | 使用 `shared_core` |
| 模型 | `src/models/` | 使用 `shared_core.schemas` |
| 日志服务 | 内嵌 | 代理到独立服务 |

---

## 相关文档

- [架构重构迁移设计](../../架构重构迁移设计.md)
- [服务总览](../README.md)
- [共享包文档](../../shared/python/README.md)
