"""WebSocket 会话模型"""
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
import uuid


class WebSocketSession(BaseModel):
    """WebSocket 会话模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_type: str
    user_id: str = "local"
    connection_id: Optional[str] = None
    status: str = "active"
    context_id: Optional[str] = None
    model_configuration: Optional[Dict[str, Any]] = Field(default=None, alias="model_config")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    last_activity_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)
    closed_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        populate_by_name = True

    def update_activity(self):
        """更新最后活动时间"""
        self.last_activity_at = datetime.now()

    def close(self, reason: str = "user_exit"):
        """关闭会话"""
        self.status = "closed"
        self.closed_at = datetime.now()
        if self.metadata is None:
            self.metadata = {}
        self.metadata["close_reason"] = reason


class RealtimeMessage(BaseModel):
    """实时消息模型"""
    id: Optional[int] = None
    session_id: str
    message_type: str = "text"
    role: str
    content: str
    content_chunks: Optional[str] = None
    tokens_used: Optional[int] = None
    latency_ms: Optional[int] = None
    model_name: Optional[str] = None
    provider: Optional[str] = None
    is_streaming: bool = False
    streaming_status: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class AIAssistantSession(BaseModel):
    """AI 助手会话模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    websocket_session_id: Optional[str] = None
    title: Optional[str] = None
    message_count: int = 0
    last_message_at: Optional[datetime] = None
    is_pinned: bool = False
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class WebSocketConnectionLog(BaseModel):
    """WebSocket 连接日志模型"""
    id: Optional[int] = None
    connection_id: str
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None
    event_type: str
    error_message: Optional[str] = None
    session_count: int = 0
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
