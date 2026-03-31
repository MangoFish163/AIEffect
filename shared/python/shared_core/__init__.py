"""AIEffect 共享核心模块

该模块提供 AIEffect 项目各服务间共享的核心功能：
- 配置管理 (config)
- 日志系统 (logger)
- 数据库管理 (database)
- 数据模型 (schemas)
- 端口管理 (port_manager)
- CURL 解析器 (curl_parser)
"""

from .config import ConfigManager, get_config_manager, Settings, AppConfig
from .curl_parser import CURLParser, cURLGeneralSpecifications, generate_standard_curl
from .logger import setup_logger, get_logger, LogEntry, InMemoryLogHandler, DatabaseLogHandler, get_in_memory_handler
from .database import get_db, DatabaseManager, get_config_with_fallback, get_all_config, DEFAULT_CONFIG
from .port_manager import PortManager
from .schemas import (
    Message, CharacterMemory, BaseResponse, PaginationData,
    HealthResponse, APIConfig, TTSConfig, SubtitleConfig,
    MemoryConfig, PortConfig, ConfigResponse, UpdateConfigRequest,
    ProviderPreset, CreateProviderPresetRequest, UpdateProviderPresetRequest,
    ProxyStartRequest, ProxyStatusResponse, ProxyTestResponse,
    TTSEngineInfo, TTSEngineConfig, TTSSynthesizeRequest, TTSSynthesizeResponse,
    VoiceCharacter, CreateVoiceCharacterRequest, CharacterEmotion,
    ColorPreset, CreateColorPresetRequest,
    SubtitleSendRequest, SubtitleWindowControlRequest, SubtitleHistoryEntry,
    MemoryStatus, ConversationMessage, MemoryCompressResponse,
    LogEntry as LogEntrySchema, LogStats,
    ASRConfig, ASRSession,
    Agent, CreateAgentRequest, UpdateAgentPositionRequest, UpdateAgentStatusRequest,
    AgentMessage, SendAgentMessageRequest, AgentMessageResponse, AgentZone, TokenStats,
    FileItem, DirectoryBrowseResponse, DirectoryTreeNode,
    SystemInfo, HealthCheckResponse, PortsResponse,
    LogEntryResponse, LogListResponse, CharacterListResponse,
    MemoryCompressRequest, SubtitleShowRequest, SubtitleWindowResponse,
    GameCharacter, CreateGameCharacterRequest, UpdateGameCharacterRequest,
    ImportCharacterRequest, CharacterMemoryInfo, ConversationMessageItem,
    CreateConversationMessageRequest, MemoryCompressionHistoryItem
)

__version__ = "0.1.0"
__all__ = [
    "ConfigManager", "get_config_manager", "Settings", "AppConfig",
    "CURLParser", "cURLGeneralSpecifications", "generate_standard_curl",
    "setup_logger", "get_logger", "LogEntry", "InMemoryLogHandler", "DatabaseLogHandler", "get_in_memory_handler",
    "get_db", "DatabaseManager", "get_config_with_fallback", "get_all_config", "DEFAULT_CONFIG",
    "PortManager",
    "Message", "CharacterMemory", "BaseResponse", "PaginationData",
    "HealthResponse", "APIConfig", "TTSConfig", "SubtitleConfig",
    "MemoryConfig", "PortConfig", "ConfigResponse", "UpdateConfigRequest",
    "ProviderPreset", "CreateProviderPresetRequest", "UpdateProviderPresetRequest",
    "ProxyStartRequest", "ProxyStatusResponse", "ProxyTestResponse",
    "TTSEngineInfo", "TTSEngineConfig", "TTSSynthesizeRequest", "TTSSynthesizeResponse",
    "VoiceCharacter", "CreateVoiceCharacterRequest", "CharacterEmotion",
    "ColorPreset", "CreateColorPresetRequest",
    "SubtitleSendRequest", "SubtitleWindowControlRequest", "SubtitleHistoryEntry",
    "MemoryStatus", "ConversationMessage", "MemoryCompressResponse",
    "LogEntrySchema", "LogStats",
    "ASRConfig", "ASRSession",
    "Agent", "CreateAgentRequest", "UpdateAgentPositionRequest", "UpdateAgentStatusRequest",
    "AgentMessage", "SendAgentMessageRequest", "AgentMessageResponse", "AgentZone", "TokenStats",
    "FileItem", "DirectoryBrowseResponse", "DirectoryTreeNode",
    "SystemInfo", "HealthCheckResponse", "PortsResponse",
    "LogEntryResponse", "LogListResponse", "CharacterListResponse",
    "MemoryCompressRequest", "SubtitleShowRequest", "SubtitleWindowResponse",
    "GameCharacter", "CreateGameCharacterRequest", "UpdateGameCharacterRequest",
    "ImportCharacterRequest", "CharacterMemoryInfo", "ConversationMessageItem",
    "CreateConversationMessageRequest", "MemoryCompressionHistoryItem"
]
