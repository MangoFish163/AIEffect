"""数据模型模块

提供 Pydantic 数据模型定义，用于：
- API 请求/响应验证
- 数据序列化/反序列化
- 类型提示
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class Message(BaseModel):
    """消息模型"""
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)


class CharacterMemory(BaseModel):
    """角色记忆模型"""
    character_name: str
    messages: List[Message]
    last_updated: datetime
    compressed_summary: Optional[str] = None


class BaseResponse(BaseModel):
    """基础响应模型"""
    code: int = 200
    message: str = "success"
    data: Optional[Any] = None
    server_hash: Optional[str] = None  # 配置hash，用于前后端同步校验
    hash_mismatch: Optional[bool] = None  # hash是否不匹配


class PaginationData(BaseModel):
    """分页数据模型"""
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    timestamp: datetime
    version: str
    ports: Dict[str, int]


class APIConfig(BaseModel):
    """API 配置模型"""
    provider: str = "deepseek"
    api_url: str = "https://api.deepseek.com/v1"
    api_key: str = ""
    model_name: str = "deepseek-chat"


class TTSConfig(BaseModel):
    """TTS 配置模型"""
    enabled: bool = True
    engine: str = "gpt_sovits"
    volume: float = 0.8
    auto_play: bool = True
    save_audio: bool = True
    play_mode: str = "dialog"


class SubtitleConfig(BaseModel):
    """字幕配置模型"""
    font_color: str = "#ffffff"
    background_color: str = "#0a0a0f"
    opacity: float = 0.9
    font_size: int = 16
    typing_speed: int = 30
    is_visible: bool = True
    controls_hidden: bool = False


class MemoryConfig(BaseModel):
    """记忆配置模型"""
    save_dir: str = "./data/memories"
    trigger_threshold: int = 300
    compress_count: int = 50
    check_frequency: int = 30
    auto_compress: bool = False
    backup_before_compress: bool = True
    compress_prompt: str = "请用简洁的语言总结{character_name}和{player_name}之间的对话历史。当前共有{message_count}条消息。"


class PortConfig(BaseModel):
    """端口配置模型"""
    frontend: int = 8500
    api: int = 8501
    ollama_proxy: int = 8501
    websocket: int = 8502
    subtitle: int = 8503
    tts: int = 8504
    log: int = 8505


class ConfigResponse(BaseModel):
    """配置响应模型"""
    api: Dict[str, Any]
    tts: Dict[str, Any]
    subtitle: Dict[str, Any]
    memory: Dict[str, Any]
    ports: Dict[str, int]
    lan_enabled: bool


class UpdateConfigRequest(BaseModel):
    """更新配置请求"""
    api: Optional[Dict[str, Any]] = None
    tts: Optional[Dict[str, Any]] = None
    subtitle: Optional[Dict[str, Any]] = None
    memory: Optional[Dict[str, Any]] = None
    lan_enabled: Optional[bool] = None


class ProviderPreset(BaseModel):
    """API服务商预设"""
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
    """创建服务商预设请求"""
    name: str
    icon: str = "⭐"
    api_url: str
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    doc_url: Optional[str] = None
    curl_example: Optional[str] = None


class UpdateProviderPresetRequest(BaseModel):
    """更新服务商预设请求"""
    name: Optional[str] = None
    icon: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    doc_url: Optional[str] = None
    curl_example: Optional[str] = None


class ProxyStartRequest(BaseModel):
    """启动代理请求"""
    port: Optional[int] = None
    bind_address: Optional[str] = "127.0.0.1"


class ProxyStatusResponse(BaseModel):
    """代理状态响应"""
    is_running: bool
    port: Optional[int] = None
    bind_address: Optional[str] = None
    access_url: Optional[str] = None
    started_at: Optional[datetime] = None
    request_count: int = 0


class ProxyTestResponse(BaseModel):
    """代理测试响应"""
    success: bool
    latency_ms: Optional[int] = None
    model_list: Optional[List[str]] = None


class TTSEngineInfo(BaseModel):
    """TTS引擎信息"""
    id: str
    name: str
    is_available: bool
    connection_status: str


class TTSEngineConfig(BaseModel):
    """TTS引擎配置"""
    api_url: Optional[str] = None
    inference_params: Optional[Dict[str, Any]] = None
    reference_audio: Optional[Dict[str, Any]] = None
    app_id: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    voice: Optional[str] = None


class TTSSynthesizeRequest(BaseModel):
    """TTS合成请求"""
    text: str
    engine: Optional[str] = None
    voice_id: Optional[str] = None
    emotion: Optional[str] = None
    speed: float = 1.0
    save_path: Optional[str] = None


class TTSSynthesizeResponse(BaseModel):
    """TTS合成响应"""
    audio_url: Optional[str] = None
    duration_ms: Optional[int] = None
    format: str = "wav"


class VoiceCharacter(BaseModel):
    """语音角色"""
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
    """创建语音角色请求"""
    name: str
    display_name: Optional[str] = None
    reference_audio_dir: Optional[str] = None
    emotion_config_path: Optional[str] = None
    gpt_model_path: Optional[str] = None
    sovits_model_path: Optional[str] = None
    default_emotion: str = "calm"
    description: Optional[str] = None


class CharacterEmotion(BaseModel):
    """角色情感配置"""
    id: int
    emotion_name: str
    emotion_label: Optional[str] = None
    reference_audio_path: Optional[str] = None
    text_content: Optional[str] = None


class ColorPreset(BaseModel):
    """颜色预设"""
    id: str
    name: str
    color: str
    type: str
    is_custom: bool = False


class CreateColorPresetRequest(BaseModel):
    """创建颜色预设请求"""
    type: str
    name: str
    color: str


class SubtitleSendRequest(BaseModel):
    """发送字幕请求"""
    text: str
    sender: str = "assistant"
    clear_before: bool = False


class SubtitleWindowControlRequest(BaseModel):
    """字幕窗口控制请求"""
    action: str


class SubtitleHistoryEntry(BaseModel):
    """字幕历史记录"""
    id: int
    content: str
    sender: str
    session_id: Optional[str] = None
    created_at: datetime


class MemoryStatus(BaseModel):
    """记忆状态"""
    character_name: str
    message_count: int
    compressed_summary: Optional[str] = None
    last_updated: Optional[datetime] = None
    needs_compression: bool = False


class ConversationMessage(BaseModel):
    """对话消息"""
    id: int
    role: str
    content: str
    tokens: Optional[int] = None
    is_compressed: bool = False
    created_at: datetime


class MemoryCompressResponse(BaseModel):
    """记忆压缩响应"""
    compressed_count: int
    retained_count: int
    summary: str
    backup_path: Optional[str] = None


class LogEntry(BaseModel):
    """日志条目"""
    id: str
    timestamp: datetime
    level: str
    module: str
    message: str
    metadata: Optional[Dict[str, Any]] = None


class LogStats(BaseModel):
    """日志统计"""
    total: int
    error_count: int
    warn_count: int
    info_count: int


class ASRConfig(BaseModel):
    """ASR配置"""
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
    """ASR会话"""
    session_id: str
    status: str


class Agent(BaseModel):
    """智能体"""
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
    """创建智能体请求"""
    name: str
    display_name: Optional[str] = None
    role: Optional[str] = None
    avatar: str = "🤖"
    color: str = "#6366f1"
    position: Dict[str, int]
    assigned_zone: Optional[str] = None


class UpdateAgentPositionRequest(BaseModel):
    """更新智能体位置请求"""
    x: int
    y: int
    direction: Optional[str] = None


class UpdateAgentStatusRequest(BaseModel):
    """更新智能体状态请求"""
    status: str
    message: Optional[str] = None


class AgentMessage(BaseModel):
    """智能体消息"""
    id: int
    content: str
    sender: str
    response: Optional[str] = None
    tokens_used: Optional[int] = None
    created_at: datetime


class SendAgentMessageRequest(BaseModel):
    """发送智能体消息请求"""
    content: str
    sender: str = "user"


class AgentMessageResponse(BaseModel):
    """智能体消息响应"""
    message_id: str
    response: str
    timestamp: datetime


class AgentZone(BaseModel):
    """智能体区域"""
    id: str
    name: str
    type: str
    description: Optional[str] = None
    position: Dict[str, int]
    width: int = 1
    height: int = 1
    icon: str = "📍"


class TokenStats(BaseModel):
    """Token统计"""
    top_agents: List[Dict[str, Any]]
    total_tokens: int
    period: str = "24h"


class FileItem(BaseModel):
    """文件项"""
    name: str
    type: str
    size: Optional[int] = None
    modified_at: datetime


class DirectoryBrowseResponse(BaseModel):
    """目录浏览响应"""
    current_path: str
    parent_path: Optional[str] = None
    items: List[FileItem]


class DirectoryTreeNode(BaseModel):
    """目录树节点"""
    path: str
    name: str
    type: str
    children: Optional[List['DirectoryTreeNode']] = None


class SystemInfo(BaseModel):
    """系统信息"""
    version: str
    platform: str
    electron_version: Optional[str] = None
    python_version: str
    uptime_seconds: int


class HealthCheckResponse(BaseModel):
    """健康检查响应"""
    status: str
    services: Dict[str, str]


class PortsResponse(BaseModel):
    """端口响应"""
    api: int
    ollama_proxy: int
    websocket: int
    subtitle: int
    tts: int
    log: int


class LogEntryResponse(BaseModel):
    """日志条目响应"""
    timestamp: str
    level: str
    module: str
    message: str


class LogListResponse(BaseModel):
    """日志列表响应"""
    logs: List[LogEntryResponse]
    stats: Dict[str, int]


class CharacterListResponse(BaseModel):
    """角色列表响应"""
    characters: List[str]


class MemoryCompressRequest(BaseModel):
    """记忆压缩请求"""
    character_name: str
    keep_recent: Optional[int] = None


class SubtitleShowRequest(BaseModel):
    """显示字幕请求"""
    text: str
    character_name: Optional[str] = None
    typing_effect: bool = True


class SubtitleWindowResponse(BaseModel):
    """字幕窗口响应"""
    visible: bool
    current_text: Optional[str] = None


class GameCharacter(BaseModel):
    """游戏角色"""
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
    """创建游戏角色请求"""
    name: str
    save_id: Optional[str] = None
    ai_soul: Optional[str] = None
    ai_voice: Optional[str] = None
    avatar_url: Optional[str] = None
    compression_enabled: bool = False
    interaction_ops: List[str] = []


class UpdateGameCharacterRequest(BaseModel):
    """更新游戏角色请求"""
    name: Optional[str] = None
    save_id: Optional[str] = None
    ai_soul: Optional[str] = None
    ai_voice: Optional[str] = None
    avatar_url: Optional[str] = None
    compression_enabled: Optional[bool] = None
    interaction_ops: Optional[List[str]] = None


class ImportCharacterRequest(BaseModel):
    """导入角色请求"""
    payload: Dict[str, Any]


class CharacterMemoryInfo(BaseModel):
    """角色记忆信息"""
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
    """对话消息项"""
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
    """创建对话消息请求"""
    kind: str
    speaker: Optional[str] = None
    content: str
    tokens: Optional[int] = None
    session_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class MemoryCompressionHistoryItem(BaseModel):
    """记忆压缩历史项"""
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
