from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)


class CharacterMemory(BaseModel):
    character_name: str
    messages: List[Message]
    last_updated: datetime
    compressed_summary: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str
    ports: Dict[str, int]


class ConfigResponse(BaseModel):
    api: Dict[str, Any]
    tts: Dict[str, Any]
    subtitle: Dict[str, Any]
    memory: Dict[str, Any]
    ports: Dict[str, int]
    lan_enabled: bool


class UpdateConfigRequest(BaseModel):
    api: Optional[Dict[str, Any]] = None
    tts: Optional[Dict[str, Any]] = None
    subtitle: Optional[Dict[str, Any]] = None
    memory: Optional[Dict[str, Any]] = None
    lan_enabled: Optional[bool] = None


class ProxyStartRequest(BaseModel):
    port: Optional[int] = None


class ProxyStatusResponse(BaseModel):
    running: bool
    port: Optional[int] = None
    external_address: Optional[str] = None


class TTSSynthesizeRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None
    engine: Optional[str] = None
    speed: float = 1.0
    volume: Optional[float] = None


class TTSSynthesizeResponse(BaseModel):
    audio_url: Optional[str] = None
    duration: Optional[float] = None
    success: bool
    message: str


class SubtitleShowRequest(BaseModel):
    text: str
    character_name: Optional[str] = None
    typing_effect: bool = True


class SubtitleWindowResponse(BaseModel):
    visible: bool
    current_text: Optional[str] = None


class CharacterListResponse(BaseModel):
    characters: List[str]


class MemoryCompressRequest(BaseModel):
    character_name: str
    keep_recent: Optional[int] = None


class MemoryCompressResponse(BaseModel):
    success: bool
    message: str
    compressed_count: Optional[int] = None
    summary: Optional[str] = None


class LogListRequest(BaseModel):
    level: Optional[str] = None
    module: Optional[str] = None
    search: Optional[str] = None
    limit: int = 100


class LogEntryResponse(BaseModel):
    timestamp: str
    level: str
    module: str
    message: str


class LogListResponse(BaseModel):
    logs: List[LogEntryResponse]
    stats: Dict[str, int]


class PortsResponse(BaseModel):
    api: int
    ollama_proxy: int
    websocket: int
    subtitle: int
    tts: int
    log: int
