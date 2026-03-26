# AIEffect WebSocket 服务设计文档

## 1. 概述

### 1.1 设计目标

为 AIEffect 项目提供统一的实时通信服务，支持多场景 AI 对话：

- **AI 助手对话**（控制面板）
- **Agents 办公室多 Agent 协作对话**
- **角色即时对话**（未来扩展）
- **语音实时对话**（未来扩展）

### 1.2 核心优势

| 特性 | 说明 |
|------|------|
| **统一连接管理** | 单一服务管理所有实时对话连接 |
| **会话隔离** | 不同对话场景独立会话，互不干扰 |
| **多模型并发** | 同时连接多个不同 LLM Provider |
| **双向实时** | 真正的双向通信，支持流式输出 |
| **扩展性强** | 预留语音、多模态等扩展接口 |

### 1.3 服务信息

- **服务端口**: 8502（通过配置管理器动态读取）
- **协议**: WebSocket (ws://localhost:8502/ws)
- **技术栈**: Python + FastAPI + WebSocket
- **Python版本**: ^3.10

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         前端应用 (Frontend)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  控制面板     │  │  Agents办公室 │  │   角色对话    │              │
│  │  AI助手对话   │  │  多Agent对话  │  │  即时角色交互  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼─────────────────┼─────────────────┼──────────────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │ WebSocket 连接
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              WebSocket Gateway Service (Port 8502)                   │
├─────────────────────────────────────────────────────────────────────┤
│  连接管理层 (Connection Manager)                                     │
│    - 连接认证 (Token/Session 验证)                                   │
│    - 心跳检测 (Heartbeat 30s)                                       │
│    - 断线重连 (Reconnection)                                        │
│    - 连接池管理                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  会话管理层 (Session Manager)                                        │
│    - 会话创建/销毁                                                   │
│    - 会话路由 (Session Routing)                                     │
│    - 会话状态管理 (active/paused/closed)                            │
│    - 多会话并发支持                                                   │
├─────────────────────────────────────────────────────────────────────┤
│  对话处理器 (Conversation Handlers)                                  │
│    ┌─────────────┐ ┌──────────────┐ ┌──────────────┐               │
│    │ AI助手处理器 │ │ Agent对话处理器│ │ 角色对话处理器 │  ...        │
│    │ (控制面板)   │ │ (多Agent协作) │ │ (角色扮演)   │               │
│    └──────┬──────┘ └──────┬───────┘ └──────┬───────┘               │
└───────────┼───────────────┼────────────────┼─────────────────────────┘
            │               │                │
            ▼               ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  LLM Provider│ │  LLM Provider│ │  LLM Provider│
    │  (DeepSeek)  │ │  (Ollama)    │ │  (OpenAI)    │
    └──────────────┘ └──────────────┘ └──────────────┘
```

### 2.2 核心组件

```python
# 核心组件结构
services/websocket/
├── src/websocket_service/
│   ├── __init__.py
│   ├── main.py                 # 服务入口
│   ├── connection/
│   │   └── manager.py          # 连接管理器
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── base.py             # 基础处理器
│   │   ├── ai_assistant.py     # AI 助手处理器
│   │   └── agent_chat.py       # Agent 对话处理器
│   ├── models/
│   │   └── session.py          # 会话模型
│   ├── protocol/
│   │   ├── constants.py        # 协议常量
│   │   └── schemas.py          # 消息协议定义
│   └── session/
│       └── manager.py          # 会话管理器
├── start.py                    # 启动脚本
├── pyproject.toml              # Poetry 配置
├── requirements.txt            # pip 依赖
├── Dockerfile                  # 容器化配置
└── README.md                   # 服务说明
```

### 2.3 依赖关系

```
main.py
├── connection/manager.py
├── session/manager.py
├── handlers/
│   ├── base.py
│   ├── ai_assistant.py
│   └── agent_chat.py
├── protocol/
│   ├── constants.py
│   └── schemas.py
└── shared_core (外部依赖)
    ├── config_manager
    ├── logger
    └── database
```

---

## 3. 通信协议

### 3.1 消息格式

所有消息采用 JSON 格式，统一结构：

```json
{
  "type": "message_type",
  "session_id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {}
}
```

### 3.2 消息类型定义

```python
class MessageType(str, Enum):
    # 连接相关
    CONNECTION_INIT = "connection.init"
    CONNECTION_ACK = "connection.ack"
    PING = "ping"
    PONG = "pong"

    # 会话相关
    SESSION_CREATE = "session.create"
    SESSION_CREATED = "session.created"
    SESSION_CLOSE = "session.close"
    SESSION_CLOSED = "session.closed"

    # 对话相关
    CHAT_MESSAGE = "chat.message"
    CHAT_CHUNK = "chat.chunk"
    CHAT_COMPLETED = "chat.completed"

    # Agent 相关
    AGENT_RESPONSE = "agent.response"
    AGENT_COLLABORATION = "agent.collaboration"

    # 错误
    ERROR = "error"
```

### 3.3 客户端 → 服务端 消息类型

#### 3.3.1 连接初始化

```json
{
  "type": "connection.init",
  "data": {
    "client_version": "1.0.0",
    "capabilities": ["streaming", "multimodal"]
  }
}
```

#### 3.3.2 创建会话

```json
{
  "type": "session.create",
  "data": {
    "session_type": "ai_assistant",
    "context_id": null,
    "model_config": {
      "provider": "deepseek",
      "model": "deepseek-chat",
      "temperature": 0.7,
      "max_tokens": 2000
    }
  }
}
```

**session_type 枚举**:
- `ai_assistant` - AI 助手对话（控制面板）
- `agent_chat` - Agents 办公室多 Agent 对话
- `character_chat` - 角色即时对话（预留）
- `voice_chat` - 语音实时对话（预留）

#### 3.3.3 发送消息

```json
{
  "type": "chat.message",
  "session_id": "uuid",
  "data": {
    "message_id": "msg_uuid",
    "content": "你好",
    "content_type": "text",
    "streaming": true
  }
}
```

#### 3.3.4 心跳

```json
{
  "type": "ping",
  "timestamp": 1705312200000
}
```

#### 3.3.5 关闭会话

```json
{
  "type": "session.close",
  "session_id": "uuid",
  "data": {
    "reason": "user_exit"
  }
}
```

### 3.4 服务端 → 客户端 消息类型

#### 3.4.1 连接确认

```json
{
  "type": "connection.ack",
  "data": {
    "connection_id": "conn_uuid",
    "server_version": "1.0.0",
    "heartbeat_interval": 30000
  }
}
```

#### 3.4.2 会话创建成功

```json
{
  "type": "session.created",
  "data": {
    "session_id": "uuid",
    "session_type": "ai_assistant",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

#### 3.4.3 消息流式响应

```json
{
  "type": "chat.chunk",
  "session_id": "uuid",
  "data": {
    "message_id": "msg_uuid",
    "content": "你好",
    "finish_reason": null,
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 2
    }
  }
}
```

#### 3.4.4 消息完成

```json
{
  "type": "chat.completed",
  "session_id": "uuid",
  "data": {
    "message_id": "msg_uuid",
    "full_content": "你好！我是 AI 助手...",
    "finish_reason": "stop",
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 50,
      "total_tokens": 60
    }
  }
}
```

#### 3.4.5 Agent 响应（Agent 对话专用）

```json
{
  "type": "agent.response",
  "session_id": "uuid",
  "data": {
    "agent_id": "agent_001",
    "message_id": "msg_uuid",
    "content": "你好！我是 Agent..."
  }
}
```

#### 3.4.6 心跳响应

```json
{
  "type": "pong",
  "timestamp": 1705312200000
}
```

#### 3.4.7 错误消息

```json
{
  "type": "error",
  "data": {
    "code": "MODEL_NOT_CONFIGURED",
    "message": "AI 模型尚未配置",
    "details": {
      "field": "api_url"
    }
  }
}
```

### 3.5 错误码定义

```python
class ErrorCode(str, Enum):
    INVALID_MESSAGE = "invalid_message"      # 消息格式错误
    UNAUTHORIZED = "unauthorized"            # 未授权
    SESSION_NOT_FOUND = "session_not_found"  # 会话不存在
    SESSION_EXPIRED = "session_expired"      # 会话已过期
    RATE_LIMITED = "rate_limited"            # 请求过于频繁
    INTERNAL_ERROR = "internal_error"        # 内部错误
    SERVICE_UNAVAILABLE = "service_unavailable"  # 服务不可用
```

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| `INVALID_MESSAGE` | 消息格式错误 | 400 |
| `UNAUTHORIZED` | 未授权访问会话 | 401 |
| `SESSION_NOT_FOUND` | 会话不存在 | 404 |
| `SESSION_EXPIRED` | 会话已过期 | 410 |
| `RATE_LIMITED` | 请求过于频繁 | 429 |
| `INTERNAL_ERROR` | 内部错误 | 500 |
| `SERVICE_UNAVAILABLE` | 服务不可用 | 503 |

---

## 4. 核心组件详细设计

### 4.1 连接管理器 (ConnectionManager)

**职责**: 管理所有 WebSocket 连接的生命周期

**核心功能**:
```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket]  # 活跃连接
        self.connection_info: Dict[str, dict]          # 连接元数据
        self.connection_sessions: Dict[str, Set[str]]  # 连接-会话映射
        self.last_heartbeat: Dict[str, datetime]       # 最后心跳时间

    async def connect(self, websocket: WebSocket) -> Optional[str]
    async def disconnect(self, connection_id: str)
    async def send_message(self, connection_id: str, message: dict)
    async def broadcast(self, message: dict, exclude: Optional[str] = None)
    def update_heartbeat(self, connection_id: str)
    async def check_heartbeats(self)
    async def send_connection_ack(self, connection_id: str)
    async def send_pong(self, connection_id: str, timestamp: int)
    async def send_error(self, connection_id: str, code: ErrorCode, message: str, details: Optional[dict] = None)
```

**关键配置**:
- 最大连接数: 1000 (`DEFAULT_MAX_CONNECTIONS`)
- 心跳间隔: 30秒 (`DEFAULT_HEARTBEAT_INTERVAL`)
- 心跳超时: 60秒 (2倍心跳间隔)

### 4.2 会话管理器 (SessionManager)

**职责**: 管理 WebSocket 会话的创建、查询、关闭和持久化

**核心功能**:
```python
class SessionManager:
    def __init__(self):
        self.active_sessions: Dict[str, WebSocketSession]  # 内存中的活跃会话
        self.session_timeout: int = 3600  # 会话超时时间（秒）

    async def create_session(
        self,
        session_type: str,
        connection_id: str,
        context_id: Optional[str] = None,
        model_config: Optional[dict] = None,
        user_id: str = "local"
    ) -> WebSocketSession

    async def get_session(self, session_id: str) -> Optional[WebSocketSession]
    async def close_session(self, session_id: str, reason: str = "user_exit")
    async def update_session_activity(self, session_id: str)
    async def save_message(self, message: RealtimeMessage) -> int
    async def get_session_messages(self, session_id: str, limit: int = 50, offset: int = 0) -> List[RealtimeMessage]
    async def cleanup_expired_sessions(self)
```

**会话状态流转**:
```
active → paused → closed
   ↓              ↑
   └──────────────┘ (用户重新激活)
```

### 4.3 处理器基类 (BaseHandler)

**职责**: 定义消息处理器的通用接口和公共方法

```python
class BaseHandler(ABC):
    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)

    @abstractmethod
    async def handle_message(self, session_id: str, connection_id: str, message: BaseMessage, send_callback)

    @abstractmethod
    def get_session_type(self) -> str

    async def send_chunk(self, session_id: str, message_id: str, content: str, ...)
    async def send_completed(self, session_id: str, message_id: str, full_content: str, ...)
    async def save_message(self, session_manager, session_id: str, role: str, content: str, ...)
    def get_model_config(self) -> Optional[Dict[str, Any]]
    async def call_llm_api(self, messages: list, model_config: dict, stream: bool = True, ...)
```

### 4.4 AI 助手处理器 (AIAssistantHandler)

**职责**: 处理 AI 助手对话场景

**系统提示词**:
```python
SYSTEM_PROMPT = """你是星野，是 AI Voice Bridge 的虚拟助手。你可以将文字变成有感情的声音，还能理解用户说的话。请用友好、亲切的语气回答用户的问题。"""
```

**历史消息管理**:
- 最大历史消息数: 10条 (`MAX_HISTORY = 10`)
- 自动包含系统提示词

**处理流程**:
1. 接收 `session.create` → 创建会话并返回 `session.created`
2. 接收 `chat.message` → 保存用户消息 → 调用 LLM → 流式返回 `chat.chunk` → 返回 `chat.completed`
3. 接收 `session.close` → 关闭会话并返回 `session.closed`

### 4.5 Agent 对话处理器 (AgentChatHandler)

**职责**: 处理 Agents 办公室的 Agent 对话场景

**Agent 系统提示词生成**:
```python
async def _get_agent_system_prompt(self, agent_id: str) -> str:
    # 从数据库查询 Agent 信息
    # 返回: "你是{display_name}，职责是{role}。请用专业、友好的态度回答用户的问题。"
```

**处理流程**:
1. 接收 `session.create` (需包含 `context_id` 作为 Agent ID)
2. 接收 `chat.message` → 查询 Agent 信息 → 构建系统提示词 → 调用 LLM
3. 流式返回 `chat.chunk` → 返回 `agent.response` → 返回 `chat.completed`

---

## 5. 数据模型

### 5.1 WebSocket 会话模型 (WebSocketSession)

```python
class WebSocketSession(BaseModel):
    id: str                          # UUID
    session_type: str                # ai_assistant | agent_chat | character_chat | voice_chat
    user_id: str = "local"           # 用户ID
    connection_id: Optional[str]     # 关联的连接ID
    status: str = "active"           # active | paused | closed
    context_id: Optional[str]        # 上下文ID (Agent ID / Character ID)
    model_configuration: Optional[Dict[str, Any]]  # 模型配置
    metadata: Optional[Dict[str, Any]]             # 扩展元数据
    last_activity_at: Optional[datetime]
    created_at: datetime
    closed_at: Optional[datetime]
```

### 5.2 实时消息模型 (RealtimeMessage)

```python
class RealtimeMessage(BaseModel):
    id: Optional[int]
    session_id: str
    message_type: str = "text"       # text | image | voice
    role: str                        # user | assistant | system
    content: str
    content_chunks: Optional[str]    # 流式内容块JSON
    tokens_used: Optional[int]
    latency_ms: Optional[int]
    model_name: Optional[str]
    provider: Optional[str]
    is_streaming: bool = False
    streaming_status: Optional[str]  # streaming | completed | failed
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
```

### 5.3 AI 助手会话模型 (AIAssistantSession)

```python
class AIAssistantSession(BaseModel):
    id: str
    websocket_session_id: Optional[str]
    title: Optional[str]
    message_count: int = 0
    last_message_at: Optional[datetime]
    is_pinned: bool = False
    created_at: datetime
```

---

## 6. 数据库表结构

### 6.1 websocket_sessions 表

```sql
CREATE TABLE websocket_sessions (
    id TEXT PRIMARY KEY,
    session_type TEXT NOT NULL,
    user_id TEXT DEFAULT 'local',
    connection_id TEXT,
    status TEXT DEFAULT 'active',
    context_id TEXT,
    model_config TEXT,           -- JSON
    metadata TEXT,               -- JSON
    last_activity_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);
```

### 6.2 realtime_messages 表

```sql
CREATE TABLE realtime_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    role TEXT NOT NULL,
    content TEXT,
    content_chunks TEXT,         -- JSON
    tokens_used INTEGER,
    latency_ms INTEGER,
    model_name TEXT,
    provider TEXT,
    is_streaming BOOLEAN DEFAULT 0,
    streaming_status TEXT,
    metadata TEXT,               -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES websocket_sessions(id)
);
```

### 6.3 ai_assistant_sessions 表

```sql
CREATE TABLE ai_assistant_sessions (
    id TEXT PRIMARY KEY,
    websocket_session_id TEXT,
    title TEXT,
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP,
    is_pinned BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (websocket_session_id) REFERENCES websocket_sessions(id)
);
```

---

## 7. 会话生命周期

### 7.1 AI 助手会话流程

```
┌─────────┐     connect      ┌─────────────┐
│  Client │ ────────────────> │  WebSocket  │
│         │                   │   Server    │
│         │ <──────────────── │             │
│         │    connection.ack │             │
│         │                   │             │
│         │ ────────────────> │             │
│         │   session.create  │             │
│         │   (ai_assistant)  │             │
│         │ <──────────────── │             │
│         │   session.created │             │
│         │                   │             │
│         │ ────────────────> │             │
│         │    chat.message   │             │
│         │                   │             │
│         │ <──────────────── │             │
│         │    chat.chunk     │             │
│         │    chat.chunk     │             │
│         │    ...            │             │
│         │    chat.completed │             │
│         │                   │             │
│         │ ────────────────> │             │
│         │   session.close   │             │
│         │ <──────────────── │             │
│         │   session.closed  │             │
└─────────┘                   └─────────────┘
```

### 7.2 Agents 办公室多 Agent 会话流程

```
┌─────────┐                   ┌─────────────┐
│  Client │ ────────────────> │  WebSocket  │
│         │   session.create  │   Server    │
│         │   (agent_chat)    │             │
│         │   context_id:     │             │
│         │   "agent_001"     │             │
│         │ <──────────────── │             │
│         │   session.created │             │
│         │                   │             │
│         │ ────────────────> │             │
│         │   chat.message    │             │
│         │   (发给agent_001) │             │
│         │                   │             │
│         │ <──────────────── │             │
│         │   agent.response  │             │
│         │   (agent_001回复) │             │
│         │   chat.completed  │             │
└─────────┘                   └─────────────┘
```

---

## 8. 扩展性设计

### 8.1 预留扩展点

| 扩展点 | 说明 | 优先级 |
|--------|------|--------|
| **多 Agent 协作** | 支持多个 Agent 同时参与对话 | 高 |
| **语音实时对话** | WebRTC + WebSocket 语音交互 | 中 |
| **多模态支持** | 图片、文件上传对话 | 中 |
| **对话共享** | 多用户共享同一对话 | 低 |
| **插件系统** | 支持第三方插件扩展 | 低 |

### 8.2 新增处理器开发规范

要添加新的对话处理器，需遵循以下步骤：

1. **创建处理器类**继承 `BaseHandler`:
```python
class NewHandler(BaseHandler):
    def get_session_type(self) -> str:
        return "new_type"

    async def handle_message(self, session_id, connection_id, message, send_callback):
        msg_type = message.type
        if msg_type == MessageType.SESSION_CREATE:
            await self._handle_session_create(...)
        elif msg_type == MessageType.CHAT_MESSAGE:
            await self._handle_chat_message(...)
```

2. **注册处理器**在 `main.py`:
```python
HANDLERS = {
    "ai_assistant": AIAssistantHandler(),
    "agent_chat": AgentChatHandler(),
    "new_type": NewHandler(),  # 新增
}
```

3. **更新 `SessionType` 枚举**在 `protocol/constants.py`

---

## 9. 性能与安全

### 9.1 性能指标

| 指标 | 目标值 | 实现状态 |
|------|--------|----------|
| 连接建立延迟 | < 100ms | 已实现 |
| 消息转发延迟 | < 10ms | 已实现 |
| 单服务并发连接 | > 1000 | 已实现 |
| 单会话消息吞吐 | > 100 msg/s | 已实现 |

### 9.2 安全机制

- **连接认证**: 启动时生成临时 Token（预留）
- **消息验证**: 所有消息格式校验（Pydantic）
- **限流保护**: 单连接 10 msg/s，单 IP 100 msg/s（预留）
- **敏感数据**: API Key 不在 WebSocket 传输，服务端从配置读取

### 9.3 容错机制

- **断线重连**: 客户端自动重连，服务端保留会话 5 分钟
- **消息重发**: 消息 ID 去重，支持幂等
- **优雅降级**: 模型服务异常时返回友好提示

---

## 10. 部署与配置

### 10.1 依赖安装

**使用 Poetry**:
```bash
cd services/websocket
poetry install
```

**使用 pip**:
```bash
cd services/websocket
pip install -e ../../shared/python
pip install -r requirements.txt
```

### 10.2 启动服务

**使用启动脚本**:
```bash
python start.py
```

**使用 Poetry**:
```bash
poetry run python start.py
```

**直接运行**:
```bash
python -m websocket_service.main
```

### 10.3 配置管理

WebSocket 服务通过 `shared_core` 的配置管理器读取配置：

```python
config_manager = get_config_manager()
port = config_manager.config.ports.websocket  # 默认 8502
```

配置项:
- `ports.websocket`: WebSocket 服务端口
- `api.api_url`: LLM API 地址
- `api.api_key`: LLM API 密钥
- `api.model_name`: 模型名称

### 10.4 健康检查

```bash
GET http://localhost:8502/health
```

响应:
```json
{
  "status": "healthy",
  "connections": 5,
  "timestamp": "2024-01-15T10:30:00"
}
```

---

## 11. 与现有系统的关系

### 11.1 与 HTTP API 的关系

| 功能 | WebSocket (8502) | HTTP API (8501) |
|------|------------------|-----------------|
| 实时对话 | 主要方式 | 兼容保留 |
| 配置管理 | - | 主要方式 |
| 文件上传 | 预留 | 主要方式 |
| 历史查询 | - | 主要方式 |

### 11.2 迁移策略

1. **第一阶段**: 实现 WebSocket 服务，AI 助手对话双模式支持
2. **第二阶段**: 前端优先使用 WebSocket，HTTP 作为 fallback
3. **第三阶段**: Agents 办公室迁移到 WebSocket
4. **第四阶段**: HTTP API 精简，仅保留配置、文件等非实时接口

---

## 12. 开发规范

### 12.1 代码规范

- 使用类型注解
- 异步函数使用 `async/await`
- 错误处理使用 try-except 并记录日志
- 数据库操作使用参数化查询防止 SQL 注入

### 12.2 日志规范

```python
from shared_core import get_logger

logger = get_logger(__name__)
logger.info(f"Session created: {session_id}")
logger.error(f"Error: {e}")
```

### 12.3 测试规范

```python
import pytest

@pytest.mark.asyncio
async def test_session_creation():
    # 测试代码
    pass
```

---

## 13. 附录

### 13.1 相关文档

- [数据库设计文档](./数据库设计.md) - WebSocket 会话存储表定义
- [后端接口约束规范](./后端接口约束规范.md) - HTTP API 规范

### 13.2 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2024-01-15 | 初始版本，支持 AI 助手和 Agent 对话 |
| v1.1 | 2024-03-26 | 完善设计文档，补充详细组件设计 |

### 13.3 技术依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| fastapi | ^0.104.0 | Web 框架 |
| uvicorn | ^0.24.0 | ASGI 服务器 |
| websockets | ^12.0 | WebSocket 支持 |
| httpx | ^0.25.0 | HTTP 客户端 |
| pydantic | ^2.5.0 | 数据验证 |
