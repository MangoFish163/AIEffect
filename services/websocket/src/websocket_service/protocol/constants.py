"""WebSocket 协议常量定义"""
from enum import Enum


class MessageType(str, Enum):
    """消息类型枚举"""
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


class SessionType(str, Enum):
    """会话类型枚举"""
    AI_ASSISTANT = "ai_assistant"
    AGENT_CHAT = "agent_chat"
    CHARACTER_CHAT = "character_chat"
    VOICE_CHAT = "voice_chat"


class SessionStatus(str, Enum):
    """会话状态枚举"""
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"


class StreamingStatus(str, Enum):
    """流式消息状态枚举"""
    STREAMING = "streaming"
    COMPLETED = "completed"


class ErrorCode(str, Enum):
    """错误码枚举"""
    INVALID_MESSAGE = "invalid_message"
    UNAUTHORIZED = "unauthorized"
    SESSION_NOT_FOUND = "session_not_found"
    SESSION_EXPIRED = "session_expired"
    RATE_LIMITED = "rate_limited"
    INTERNAL_ERROR = "internal_error"
    SERVICE_UNAVAILABLE = "service_unavailable"


# 默认配置
DEFAULT_HEARTBEAT_INTERVAL = 30  # 秒
DEFAULT_SESSION_TIMEOUT = 3600  # 秒
DEFAULT_MAX_CONNECTIONS = 1000
