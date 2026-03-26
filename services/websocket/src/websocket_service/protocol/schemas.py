"""WebSocket 消息协议定义"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime


class BaseMessage(BaseModel):
    """基础消息模型"""
    type: str
    session_id: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    data: Dict[str, Any] = Field(default_factory=dict)


# 连接相关消息
class ConnectionInitData(BaseModel):
    """连接初始化数据"""
    client_version: str = "1.0.0"
    capabilities: List[str] = Field(default_factory=lambda: ["streaming"])


class ConnectionAckData(BaseModel):
    """连接确认数据"""
    connection_id: str
    server_version: str = "1.0.0"
    heartbeat_interval: int = 30000  # 毫秒


class PingData(BaseModel):
    """心跳请求数据"""
    timestamp: int


class PongData(BaseModel):
    """心跳响应数据"""
    timestamp: int


# 会话相关消息
class ModelConfig(BaseModel):
    """模型配置"""
    provider: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 2000


class SessionCreateData(BaseModel):
    """创建会话数据"""
    session_type: str
    context_id: Optional[str] = None
    model_configuration: Optional[ModelConfig] = None
    participants: Optional[List[str]] = None
    mode: Optional[str] = None


class SessionCreatedData(BaseModel):
    """会话创建成功数据"""
    session_id: str
    session_type: str
    created_at: str


class SessionCloseData(BaseModel):
    """关闭会话数据"""
    reason: str = "user_exit"


class SessionClosedData(BaseModel):
    """会话关闭数据"""
    session_id: str
    reason: str
    closed_at: str


# 对话相关消息
class ChatMessageData(BaseModel):
    """发送消息数据"""
    message_id: str
    content: str
    content_type: str = "text"
    streaming: bool = True


class TokenUsage(BaseModel):
    """Token 使用量"""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatChunkData(BaseModel):
    """消息流式响应数据"""
    message_id: str
    content: str
    finish_reason: Optional[str] = None
    usage: Optional[TokenUsage] = None


class ChatCompletedData(BaseModel):
    """消息完成数据"""
    message_id: str
    full_content: str
    finish_reason: str
    usage: TokenUsage


# Agent 相关消息
class AgentResponseData(BaseModel):
    """Agent 响应数据"""
    agent_id: str
    message_id: str
    content: str
    action: Optional[str] = None


class AgentCollaborationData(BaseModel):
    """Agent 协作数据"""
    from_agent: str
    to_agents: List[str]
    action: str
    content: str


# 错误消息
class ErrorDetails(BaseModel):
    """错误详情"""
    field: Optional[str] = None
    info: Optional[str] = None


class ErrorData(BaseModel):
    """错误数据"""
    code: str
    message: str
    details: Optional[ErrorDetails] = None
