# AIEffect WebSocket Service 项目结构文档

## 项目概述

WebSocket Service 是 AIEffect 的实时通信服务，负责：
- WebSocket 连接管理
- 实时 AI 对话（流式响应）
- 会话管理
- 心跳检测

**注意**：此服务从 `backend/src/websocket_service/` 迁移而来。

---

## 目录结构

```
services/websocket/
├── Dockerfile                      # Docker 镜像构建配置
├── PROJECT_STRUCTURE.md            # 本文档
├── README.md                       # 服务说明文档
├── pyproject.toml                  # Poetry 依赖管理
├── requirements.txt                # pip 依赖（备选）
├── start.py                        # 服务启动脚本
└── src/
    └── websocket_service/
        ├── __init__.py             # 包初始化
        ├── main.py                 # WebSocket 服务入口
        ├── protocol/               # 协议定义层
        │   ├── __init__.py
        │   ├── constants.py        # 协议常量（消息类型、状态码）
        │   └── schemas.py          # 消息数据模型
        ├── models/                 # 数据模型层
        │   ├── __init__.py
        │   └── session.py          # 会话、消息、日志模型
        ├── connection/             # 连接管理层
        │   ├── __init__.py
        │   └── manager.py          # 连接管理器
        ├── session/                # 会话管理层
        │   ├── __init__.py
        │   └── manager.py          # 会话管理器
        └── handlers/               # 消息处理器层
            ├── __init__.py
            ├── base.py             # 处理器基类
            ├── ai_assistant.py     # AI 助手处理器
            └── agent_chat.py       # Agent 对话处理器
```

---

## 核心设计原则

### 1. 依赖共享包

```python
# ✅ 正确：使用共享包
from shared_core import get_config_manager, get_logger, get_db
from shared_core import BaseResponse

# ❌ 错误：相对导入（已移除）
from ..core.config import get_config_manager
```

### 2. 协议驱动设计

所有消息遵循统一的协议规范：

```python
# protocol/schemas.py
class BaseMessage(BaseModel):
    type: str
    session_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Optional[Dict[str, Any]] = None
```

### 3. 处理器模式

每种会话类型对应一个处理器：

```python
# handlers/base.py
class BaseHandler(ABC):
    @abstractmethod
    async def handle(self, message: BaseMessage) -> None:
        pass
```

---

## 文件功能详解

### main.py

**WebSocket 服务入口**

- FastAPI 应用实例
- WebSocket 端点 `/ws`
- 消息路由分发
- 心跳检查任务
- 健康检查端点 `/health`

### protocol/constants.py

**协议常量定义**

- `MessageType` - 消息类型枚举
- `SessionStatus` - 会话状态枚举
- `ErrorCode` - 错误码定义
- 默认配置常量

### protocol/schemas.py

**消息协议模型**

- `BaseMessage` - 基础消息
- `ConnectionInitData/AckData` - 连接握手
- `PingData/PongData` - 心跳
- `SessionCreateData/CreatedData` - 会话创建
- `ChatMessageData/ChunkData/CompletedData` - 聊天消息

### connection/manager.py

**连接管理器**

- 连接建立/断开处理
- 消息发送（JSON、错误、心跳）
- 心跳检测和超时处理
- 连接与会话映射

### session/manager.py

**会话管理器**

- 会话创建/关闭/查询
- 会话活动更新
- 消息保存和查询
- 过期会话清理

### handlers/

**消息处理器**

| 处理器 | 用途 | 会话类型 |
|--------|------|----------|
| `ai_assistant.py` | AI 助手对话 | `ai_assistant` |
| `agent_chat.py` | Agent 实时对话 | `agent_chat` |

---

## 技术栈

| 组件 | 用途 | 版本 |
|------|------|------|
| FastAPI | Web 框架 | ^0.104.0 |
| WebSockets | WebSocket 支持 | ^12.0 |
| Pydantic | 数据验证 | ^2.5.0 |
| shared_core | 共享核心模块 | 本地路径 |

---

## 端口配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| WebSocket | 8502 | 本服务端口 |
| API Gateway | 8500 | API 网关（前端获取配置）|

---

## 消息协议

### 连接流程

```
Client          Server
  |                |
  |--- WebSocket -->|
  |                |
  |<-- connection.ack|
  |                |
  |-- connection.init->
  |                |
  |<-- session.created|
  |                |
  |== 正常通信 ==|
```

### 消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| `connection.init` | C→S | 连接初始化 |
| `connection.ack` | S→C | 连接确认 |
| `ping` / `pong` | 双向 | 心跳 |
| `session.create` | C→S | 创建会话 |
| `session.created` | S→C | 会话创建成功 |
| `chat.message` | C→S | 发送消息 |
| `chat.chunk` | S→C | 流式响应块 |
| `chat.completed` | S→C | 消息完成 |
| `error` | S→C | 错误 |

---

## 与原 backend/src/websocket_service/ 的差异

| 项目 | 原位置 | 新位置 |
|------|--------|--------|
| 位置 | `backend/src/websocket_service/` | `services/websocket/` |
| 导入 | 相对导入 `from ..core` | 共享包 `from shared_core` |
| 启动 | `python start_websocket.py` | `python start.py` |
| 依赖 | 共用 backend 依赖 | 独立 Poetry 管理 |

---

## 开发规范

### 1. 新增处理器

1. 继承 `BaseHandler`
2. 实现 `handle` 方法
3. 在 `handlers/__init__.py` 中注册
4. 在 `main.py` 中添加到路由

### 2. 消息处理

```python
async def handle(self, message: BaseMessage) -> None:
    if message.type == MessageType.CHAT_MESSAGE:
        await self._handle_chat(message)
    elif message.type == MessageType.SESSION_CLOSE:
        await self._handle_close(message)
```

### 3. 流式响应

```python
async def _send_stream_response(self, session_id: str, content: str):
    chunks = self._split_content(content)
    for chunk in chunks:
        await self.send_chunk(session_id, chunk)
    await self.send_completed(session_id, full_content=content)
```

---

## 相关文档

- [架构重构迁移设计](../../架构重构迁移设计.md)
- [服务总览](../README.md)
- [共享包文档](../../shared/python/README.md)
- [原 WebSocket 文档](../../backend/PROJECT_STRUCTURE.md#websocket-服务层)
