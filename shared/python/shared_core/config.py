"""配置管理模块

提供统一的配置管理功能，支持：
- 配置文件读写 (JSON)
- 环境变量覆盖
- 单例模式管理
"""

import os
import json
from pathlib import Path
from typing import Optional, List
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from datetime import datetime


class APIConfig(BaseModel):
    """API 配置"""
    provider: str = "custom"
    api_url: str = ""
    api_key: str = ""
    model_name: str = ""
    request_format: str = "openai"


class TTSConfig(BaseModel):
    """TTS 配置"""
    enabled: bool = True
    engine: str = "gpt_sovits"
    volume: float = 0.8
    auto_play: bool = True


class SubtitleConfig(BaseModel):
    """字幕配置"""
    font_color: str = "#ffffff"
    background_color: str = "#0a0a0f"
    opacity: float = 0.9
    font_size: int = 16
    typing_speed: int = 30
    is_visible: bool = True
    controls_hidden: bool = False


class MemoryConfig(BaseModel):
    """记忆配置"""
    save_dir: str = "./data/memories"
    trigger_threshold: int = 300
    compress_count: int = 50
    check_frequency: int = 30
    auto_compress: bool = False
    backup_before_compress: bool = True
    compress_prompt: str = "请用简洁的语言总结{character_name}和{player_name}之间的对话历史。当前共有{message_count}条消息。"


class PortConfig(BaseModel):
    """端口配置"""
    api: int = Field(default=8501, description="FastAPI 主服务端口")
    ollama_proxy: int = Field(default=11434, description="Ollama 代理服务端口")
    websocket: int = Field(default=8502, description="WebSocket 服务端口")
    subtitle: int = Field(default=8503, description="字幕服务端口")
    tts: int = Field(default=8504, description="TTS 服务端口")
    log: int = Field(default=8505, description="日志服务端口")


class AppConfig(BaseModel):
    """应用配置"""
    api: APIConfig = Field(default_factory=APIConfig)
    tts: TTSConfig = Field(default_factory=TTSConfig)
    subtitle: SubtitleConfig = Field(default_factory=SubtitleConfig)
    memory: MemoryConfig = Field(default_factory=MemoryConfig)
    ports: PortConfig = Field(default_factory=PortConfig)
    lan_enabled: bool = False


class Settings(BaseSettings):
    """环境设置"""
    host: str = "0.0.0.0"
    api_port: int = 8501
    ollama_proxy_port: int = 11434
    ws_port: int = 8502
    subtitle_port: int = 8503
    tts_port: int = 8504
    log_port: int = 8505
    data_dir: str = "./data"
    config_path: str = "./data/config.json"
    ollama_base_url: str = "http://localhost:11434"
    log_level: str = "INFO"
    log_file: str = "./data/app.log"
    auto_update: bool = True
    start_minimized: bool = False

    class Config:
        env_prefix = "AIEFFECT_"
        env_file = ".env"


class ConfigManager:
    """配置管理器（单例模式）"""
    _instance: Optional['ConfigManager'] = None
    _config: Optional[AppConfig] = None
    _settings: Optional[Settings] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._settings is None:
            self._settings = Settings()
            self._ensure_data_dir()
            self._load_config()

    def _ensure_data_dir(self):
        """确保数据目录存在"""
        data_dir = Path(self._settings.data_dir)
        data_dir.mkdir(parents=True, exist_ok=True)
        memories_dir = data_dir / "memories"
        memories_dir.mkdir(parents=True, exist_ok=True)

    def _load_config(self):
        """从文件加载配置"""
        config_path = Path(self._settings.config_path)
        if config_path.exists():
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self._config = AppConfig(**data)
            except Exception:
                self._config = AppConfig()
        else:
            self._config = AppConfig()
        self._merge_env_ports()

    def _merge_env_ports(self):
        """合并环境变量中的端口配置"""
        settings = self._settings
        port_mapping = {
            'api_port': 'api',
            'ollama_proxy_port': 'ollama_proxy',
            'ws_port': 'websocket',
            'subtitle_port': 'subtitle',
            'tts_port': 'tts',
            'log_port': 'log',
        }
        for settings_attr, port_attr in port_mapping.items():
            port = getattr(settings, settings_attr, None)
            if port is not None:
                setattr(self._config.ports, port_attr, port)

    def save_config(self):
        """保存配置到文件"""
        config_path = Path(self._settings.config_path)
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(self._config.model_dump(), f, ensure_ascii=False, indent=2)

    @property
    def config(self) -> AppConfig:
        """获取应用配置"""
        return self._config

    @property
    def settings(self) -> Settings:
        """获取环境设置"""
        return self._settings

    def update_config(self, config_dict: dict):
        """更新配置"""
        self._config = AppConfig(**{**self._config.model_dump(), **config_dict})
        self.save_config()


def get_config_manager() -> ConfigManager:
    """获取配置管理器实例"""
    return ConfigManager()
