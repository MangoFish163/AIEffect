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


class BaseResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[Any] = None
    server_hash: Optional[str] = None  # 配置hash，用于前后端同步校验
    hash_mismatch: Optional[bool] = None  # hash是否不匹配


class PaginationData(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str
    ports: Dict[str, int]


class APIConfig(BaseModel):
    provider: str = "deepseek"
    api_url: str = "https://api.deepseek.com/v1"
    api_key: str = ""
    model_name: str = "deepseek-chat"


class TTSConfig(BaseModel):
    enabled: bool = True
    engine: str = "gpt_sovits"
    volume: float = 0.8
    auto_play: bool = True
    save_audio: bool = True
    play_mode: str = "dialog"


class SubtitleConfig(BaseModel):
    font_color: str = "#ffffff"
    background_color: str = "#0a0a0f"
    opacity: float = 0.9
    font_size: int = 16
    typing_speed: int = 30
    is_visible: bool = True
    controls_hidden: bool = False


class MemoryConfig(BaseModel):
    save_dir: str = "./data/memories"
    trigger_threshold: int = 300
    compress_count: int = 50
    check_frequency: int = 30
    auto_compress: bool = False
    backup_before_compress: bool = True
    compress_prompt: str = "请用简洁的语言总结{character_name}和{player_name}之间的对话历史。当前共有{message_count}条消息。"


class PortConfig(BaseModel):
    frontend: int = 8500
    api: int = 8501
    ollama_proxy: int = 8501
    websocket: int = 8502
    subtitle: int = 8503
    tts: int = 8504
    log: int = 8505


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


class ProviderPreset(BaseModel):
    id: str
    name: str
    icon: str = "⭐"
    api_url: str
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    doc_url: Optional[str] = None
    curl_example: Optional[str] = None
    is_custom: bool = False
    is_builtin: bool = False
    sort_order: int = 0


class CreateProviderPresetRequest(BaseModel):
    name: str
    icon: str = "⭐"
    api_url: str
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    doc_url: Optional[str] = None
    curl_example: Optional[str] = None


class UpdateProviderPresetRequest(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    doc_url: Optional[str] = None
    curl_example: Optional[str] = None


class ProxyStartRequest(BaseModel):
    port: Optional[int] = None
    bind_address: Optional[str] = "127.0.0.1"


class ProxyStatusResponse(BaseModel):
    is_running: bool
    port: Optional[int] = None
    bind_address: Optional[str] = None
    access_url: Optional[str] = None
    started_at: Optional[datetime] = None
    request_count: int = 0


class ProxyTestResponse(BaseModel):
    success: bool
    latency_ms: Optional[int] = None
    model_list: Optional[List[str]] = None


class TTSEngineInfo(BaseModel):
    id: str
    name: str
    is_available: bool
    connection_status: str


class TTSEngineConfig(BaseModel):
    api_url: Optional[str] = None
    inference_params: Optional[Dict[str, Any]] = None
    reference_audio: Optional[Dict[str, Any]] = None
    app_id: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    voice: Optional[str] = None


class TTSSynthesizeRequest(BaseModel):
    text: str
    engine: Optional[str] = None
    voice_id: Optional[str] = None
    emotion: Optional[str] = None
    speed: float = 1.0
    save_path: Optional[str] = None


class TTSSynthesizeResponse(BaseModel):
    audio_url: Optional[str] = None
    duration_ms: Optional[int] = None
    format: str = "wav"


class VoiceCharacter(BaseModel):
    id: str
    name: str
    display_name: Optional[str] = None
    reference_audio_dir: Optional[str] = None
    emotion_config_path: Optional[str] = None
    gpt_model_path: Optional[str] = None
    sovits_model_path: Optional[str] = None
    default_emotion: str = "calm"
    description: Optional[str] = None
    is_default: bool = False
    created_at: datetime


class CreateVoiceCharacterRequest(BaseModel):
    name: str
    display_name: Optional[str] = None
    reference_audio_dir: Optional[str] = None
    emotion_config_path: Optional[str] = None
    gpt_model_path: Optional[str] = None
    sovits_model_path: Optional[str] = None
    default_emotion: str = "calm"
    description: Optional[str] = None


class CharacterEmotion(BaseModel):
    id: int
    emotion_name: str
    emotion_label: Optional[str] = None
    reference_audio_path: Optional[str] = None
    text_content: Optional[str] = None


class ColorPreset(BaseModel):
    id: str
    name: str
    color: str
    type: str
    is_custom: bool = False


class CreateColorPresetRequest(BaseModel):
    type: str
    name: str
    color: str


class SubtitleSendRequest(BaseModel):
    text: str
    sender: str = "assistant"
    clear_before: bool = False


class SubtitleWindowControlRequest(BaseModel):
    action: str


class SubtitleHistoryEntry(BaseModel):
    id: int
    content: str
    sender: str
    session_id: Optional[str] = None
    created_at: datetime


class MemoryStatus(BaseModel):
    character_name: str
    message_count: int
    compressed_summary: Optional[str] = None
    last_updated: Optional[datetime] = None
    needs_compression: bool = False


class ConversationMessage(BaseModel):
    id: int
    role: str
    content: str
    tokens: Optional[int] = None
    is_compressed: bool = False
    created_at: datetime


class MemoryCompressResponse(BaseModel):
    compressed_count: int
    retained_count: int
    summary: str
    backup_path: Optional[str] = None


class LogEntry(BaseModel):
    id: str
    timestamp: datetime
    level: str
    module: str
    message: str
    metadata: Optional[Dict[str, Any]] = None


class LogStats(BaseModel):
    total: int
    error_count: int
    warn_count: int
    info_count: int


class ASRConfig(BaseModel):
    enabled: bool = False
    provider: str = "baidu"
    shortcut: str = "Ctrl+Shift+,"
    paste_mode: str = "direct"
    baidu_app_id: Optional[str] = None
    baidu_api_key: Optional[str] = None
    baidu_secret_key: Optional[str] = None
    xunfei_app_id: Optional[str] = None
    xunfei_api_key: Optional[str] = None
    xunfei_api_secret: Optional[str] = None


class ASRSession(BaseModel):
    session_id: str
    status: str


class Agent(BaseModel):
    id: str
    name: str
    display_name: Optional[str] = None
    role: Optional[str] = None
    avatar: str = "🤖"
    color: str = "#6366f1"
    position: Dict[str, int]
    direction: str = "down"
    status: str = "idle"
    status_message: Optional[str] = None
    is_active: bool = True
    assigned_zone: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CreateAgentRequest(BaseModel):
    name: str
    display_name: Optional[str] = None
    role: Optional[str] = None
    avatar: str = "🤖"
    color: str = "#6366f1"
    position: Dict[str, int]
    assigned_zone: Optional[str] = None


class UpdateAgentPositionRequest(BaseModel):
    x: int
    y: int
    direction: Optional[str] = None


class UpdateAgentStatusRequest(BaseModel):
    status: str
    message: Optional[str] = None


class AgentMessage(BaseModel):
    id: int
    content: str
    sender: str
    response: Optional[str] = None
    tokens_used: Optional[int] = None
    created_at: datetime


class SendAgentMessageRequest(BaseModel):
    content: str
    sender: str = "user"


class AgentMessageResponse(BaseModel):
    message_id: str
    response: str
    timestamp: datetime


class AgentZone(BaseModel):
    id: str
    name: str
    type: str
    description: Optional[str] = None
    position: Dict[str, int]
    width: int = 1
    height: int = 1
    icon: str = "📍"


class TokenStats(BaseModel):
    top_agents: List[Dict[str, Any]]
    total_tokens: int
    period: str = "24h"


class FileItem(BaseModel):
    name: str
    type: str
    size: Optional[int] = None
    modified_at: datetime


class DirectoryBrowseResponse(BaseModel):
    current_path: str
    parent_path: Optional[str] = None
    items: List[FileItem]


class DirectoryTreeNode(BaseModel):
    path: str
    name: str
    type: str
    children: Optional[List['DirectoryTreeNode']] = None


class SystemInfo(BaseModel):
    version: str
    platform: str
    electron_version: Optional[str] = None
    python_version: str
    uptime_seconds: int


class HealthCheckResponse(BaseModel):
    status: str
    services: Dict[str, str]


class PortsResponse(BaseModel):
    api: int
    ollama_proxy: int
    websocket: int
    subtitle: int
    tts: int
    log: int


class LogEntryResponse(BaseModel):
    timestamp: str
    level: str
    module: str
    message: str


class LogListResponse(BaseModel):
    logs: List[LogEntryResponse]
    stats: Dict[str, int]


class CharacterListResponse(BaseModel):
    characters: List[str]


class MemoryCompressRequest(BaseModel):
    character_name: str
    keep_recent: Optional[int] = None


class SubtitleShowRequest(BaseModel):
    text: str
    character_name: Optional[str] = None
    typing_effect: bool = True


class SubtitleWindowResponse(BaseModel):
    visible: bool
    current_text: Optional[str] = None


class GameCharacter(BaseModel):
    id: str
    name: str
    save_id: Optional[str] = None
    ai_soul: Optional[str] = None
    ai_voice: Optional[str] = None
    avatar_url: Optional[str] = None
    token_usage: int = 0
    chat_count: int = 0
    compression_enabled: bool = False
    interaction_ops: List[str] = []
    extra_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class CreateGameCharacterRequest(BaseModel):
    name: str
    save_id: Optional[str] = None
    ai_soul: Optional[str] = None
    ai_voice: Optional[str] = None
    avatar_url: Optional[str] = None
    compression_enabled: bool = False
    interaction_ops: List[str] = []


class UpdateGameCharacterRequest(BaseModel):
    name: Optional[str] = None
    save_id: Optional[str] = None
    ai_soul: Optional[str] = None
    ai_voice: Optional[str] = None
    avatar_url: Optional[str] = None
    compression_enabled: Optional[bool] = None
    interaction_ops: Optional[List[str]] = None


class ImportCharacterRequest(BaseModel):
    payload: Dict[str, Any]


class CharacterMemoryInfo(BaseModel):
    character_id: str
    message_count: int = 0
    compressed_summary: Optional[str] = None
    summary_tokens: Optional[int] = None
    last_message_id: Optional[int] = None
    last_compressed_at: Optional[datetime] = None
    compression_count: int = 0
    updated_at: datetime
    created_at: datetime


class ConversationMessageItem(BaseModel):
    id: int
    character_id: str
    kind: str
    speaker: Optional[str] = None
    content: str
    tokens: Optional[int] = None
    is_compressed: bool = False
    compressed_batch_id: Optional[int] = None
    session_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


class CreateConversationMessageRequest(BaseModel):
    kind: str
    speaker: Optional[str] = None
    content: str
    tokens: Optional[int] = None
    session_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class MemoryCompressionHistoryItem(BaseModel):
    id: int
    character_id: str
    original_count: int
    retained_count: int
    compressed_count: int
    summary: str
    backup_path: Optional[str] = None
    prompt_used: Optional[str] = None
    model_used: Optional[str] = None
    duration_ms: Optional[int] = None
    created_at: datetime
