"""数据库管理模块

提供 SQLite 数据库管理功能：
- 异步数据库连接
- 数据库初始化
- 表结构管理
"""

import os
import json
import aiosqlite
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
from .logger import get_logger

logger = get_logger(__name__)

DATABASE_FILE = "data/aieffect.db"

INIT_SQL = """
-- 关闭外键约束检查（解决表创建顺序问题）
PRAGMA foreign_keys = OFF;

-- 配置表
CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    category TEXT DEFAULT 'general',
    is_encrypted BOOLEAN DEFAULT 0,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API服务商预设表
CREATE TABLE IF NOT EXISTS provider_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '⭐',
    api_url TEXT NOT NULL,
    api_key TEXT,
    model_name TEXT,
    doc_url TEXT,
    curl_example TEXT,
    is_custom BOOLEAN DEFAULT 0,
    is_builtin BOOLEAN DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    extra_data TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TTS引擎配置表
CREATE TABLE IF NOT EXISTS tts_engines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT 1,
    is_available BOOLEAN DEFAULT 0,
    api_url TEXT,
    config TEXT,
    priority INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 语音角色表
CREATE TABLE IF NOT EXISTS voice_characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT,
    engine_id TEXT NOT NULL,
    reference_audio_dir TEXT,
    emotion_config_path TEXT,
    gpt_model_path TEXT,
    sovits_model_path TEXT,
    default_emotion TEXT DEFAULT 'calm',
    description TEXT,
    is_default BOOLEAN DEFAULT 0,
    extra_data TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (engine_id) REFERENCES tts_engines(id)
);

-- 角色情感配置表
CREATE TABLE IF NOT EXISTS character_emotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    emotion_name TEXT NOT NULL,
    emotion_label TEXT,
    reference_audio_path TEXT,
    text_content TEXT,
    sort_order INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES voice_characters(id) ON DELETE CASCADE,
    UNIQUE(character_id, emotion_name)
);

-- 字幕颜色预设表
CREATE TABLE IF NOT EXISTS subtitle_color_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    type TEXT NOT NULL,
    is_custom BOOLEAN DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL,
    module TEXT,
    message TEXT NOT NULL,
    metadata TEXT,
    source_file TEXT,
    source_line INTEGER,
    exception_type TEXT,
    exception_traceback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_module ON system_logs(module);

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 插入默认配置数据（幂等操作，使用 INSERT OR IGNORE）
-- API配置
INSERT OR IGNORE INTO config (key, value, category, description, updated_at, created_at) VALUES
('api.provider', '"local"', 'api', 'API提供商', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('api.api_url', '"http://127.0.0.1:11434/v1"', 'api', 'API地址', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('api.api_key', '""', 'api', 'API密钥', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('api.model_name', '""', 'api', '模型名称', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- TTS配置
INSERT OR IGNORE INTO config (key, value, category, description, updated_at, created_at) VALUES
('tts.enabled', 'true', 'tts', '是否启用TTS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tts.engine', '"gpt_sovits"', 'tts', 'TTS引擎', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tts.volume', '0.8', 'tts', '音量', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tts.auto_play', 'true', 'tts', '自动播放', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tts.save_audio', 'true', 'tts', '保存音频', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tts.play_mode', '"dialog"', 'tts', '播放模式', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 字幕配置
INSERT OR IGNORE INTO config (key, value, category, description, updated_at, created_at) VALUES
('subtitle.font_color', '"#ffffff"', 'subtitle', '字体颜色', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('subtitle.background_color', '"#0a0a0f"', 'subtitle', '背景颜色', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('subtitle.opacity', '0.9', 'subtitle', '透明度', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('subtitle.font_size', '16', 'subtitle', '字体大小', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('subtitle.typing_speed', '30', 'subtitle', '打字速度', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('subtitle.is_visible', 'true', 'subtitle', '是否可见', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('subtitle.controls_hidden', 'false', 'subtitle', '控制按钮隐藏', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 记忆配置
INSERT OR IGNORE INTO config (key, value, category, description, updated_at, created_at) VALUES
('memory.save_dir', '"./data/memories"', 'memory', '保存目录', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('memory.trigger_threshold', '300', 'memory', '触发阈值', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('memory.compress_count', '50', 'memory', '压缩数量', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('memory.check_frequency', '30', 'memory', '检查频率', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('memory.auto_compress', 'false', 'memory', '自动压缩', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('memory.backup_before_compress', 'true', 'memory', '压缩前备份', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('memory.compress_prompt', '"请用简洁的语言总结{character_name}和{player_name}之间的对话历史。当前共有{message_count}条消息。"', 'memory', '压缩提示词', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 端口配置
INSERT OR IGNORE INTO config (key, value, category, description, updated_at, created_at) VALUES
('ports.frontend', '8500', 'ports', '前端端口', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ports.api', '8501', 'ports', 'API端口', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ports.ollama_proxy', '11434', 'ports', 'Ollama代理端口', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ports.websocket', '8502', 'ports', 'WebSocket端口', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ports.subtitle', '8503', 'ports', '字幕端口', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ports.tts', '8504', 'ports', 'TTS端口', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ports.log', '8505', 'ports', '日志端口', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 通用配置
INSERT OR IGNORE INTO config (key, value, category, description, updated_at, created_at) VALUES
('lan_enabled', 'false', 'general', '是否启用局域网', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
"""

# 默认配置字典，用于兜底
DEFAULT_CONFIG = {
    'api': {
        'provider': 'local',
        'api_url': 'http://127.0.0.1:11434/v1',
        'api_key': '',
        'model_name': ''
    },
    'tts': {
        'enabled': True,
        'engine': 'gpt_sovits',
        'volume': 0.8,
        'auto_play': True,
        'save_audio': True,
        'play_mode': 'dialog'
    },
    'subtitle': {
        'font_color': '#ffffff',
        'background_color': '#0a0a0f',
        'opacity': 0.9,
        'font_size': 16,
        'typing_speed': 30,
        'is_visible': True,
        'controls_hidden': False
    },
    'memory': {
        'save_dir': './data/memories',
        'trigger_threshold': 300,
        'compress_count': 50,
        'check_frequency': 30,
        'auto_compress': False,
        'backup_before_compress': True,
        'compress_prompt': '请用简洁的语言总结{character_name}和{player_name}之间的对话历史。当前共有{message_count}条消息。'
    },
    'ports': {
        'frontend': 8500,
        'api': 8501,
        'ollama_proxy': 11434,
        'websocket': 8502,
        'subtitle': 8503,
        'tts': 8504,
        'log': 8505
    },
    'lan_enabled': False
}


class DatabaseManager:
    """数据库管理器"""
    _instance: Optional['DatabaseManager'] = None
    _db: Optional[aiosqlite.Connection] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def initialize(self):
        """初始化数据库"""
        if self._db is None:
            db_path = Path(DATABASE_FILE)
            db_path.parent.mkdir(parents=True, exist_ok=True)
            
            self._db = await aiosqlite.connect(db_path)
            self._db.row_factory = aiosqlite.Row
            
            # 执行初始化SQL
            await self._db.executescript(INIT_SQL)
            await self._db.commit()
            
            logger.info(f"Database initialized at {db_path}")

    async def close(self):
        """关闭数据库连接"""
        if self._db:
            await self._db.close()
            self._db = None

    @property
    def db(self) -> Optional[aiosqlite.Connection]:
        """获取数据库连接"""
        return self._db

    async def execute(self, query: str, parameters: tuple = ()):
        """执行SQL语句"""
        if self._db:
            async with self._db.execute(query, parameters) as cursor:
                await self._db.commit()
                return cursor
        return None

    async def fetchone(self, query: str, parameters: tuple = ()):
        """获取单行结果"""
        if self._db:
            async with self._db.execute(query, parameters) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None
        return None

    async def fetchall(self, query: str, parameters: tuple = ()):
        """获取所有结果"""
        if self._db:
            async with self._db.execute(query, parameters) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
        return []


_db_manager: Optional[DatabaseManager] = None


async def init_db():
    """初始化数据库"""
    global _db_manager
    _db_manager = DatabaseManager()
    await _db_manager.initialize()


async def close_db():
    """关闭数据库"""
    global _db_manager
    if _db_manager:
        await _db_manager.close()
        _db_manager = None


def get_db() -> Optional[aiosqlite.Connection]:
    """获取数据库连接"""
    global _db_manager
    if _db_manager:
        return _db_manager.db
    return None


def get_db_manager() -> Optional[DatabaseManager]:
    """获取数据库管理器"""
    global _db_manager
    return _db_manager


async def get_config_with_fallback(category: str, key: str = None) -> Any:
    """获取配置，如果数据库中没有则返回默认值
    
    Args:
        category: 配置类别 (api, tts, subtitle, memory, ports, general)
        key: 配置键名，如果为None则返回整个类别的配置
        
    Returns:
        配置值或默认值
    """
    db_manager = get_db_manager()
    if db_manager and db_manager.db:
        if key:
            full_key = f"{category}.{key}" if category != 'general' else key
            row = await db_manager.fetchone(
                "SELECT value FROM config WHERE key = ?",
                (full_key,)
            )
            if row:
                try:
                    return json.loads(row['value'])
                except (json.JSONDecodeError, TypeError):
                    return row['value']
        else:
            rows = await db_manager.fetchall(
                "SELECT key, value FROM config WHERE category = ?",
                (category,)
            )
            if rows:
                config = {}
                for row in rows:
                    try:
                        config[row['key']] = json.loads(row['value'])
                    except (json.JSONDecodeError, TypeError):
                        config[row['key']] = row['value']
                return config
    
    # 返回默认值
    if category in DEFAULT_CONFIG:
        if key:
            return DEFAULT_CONFIG[category].get(key)
        return DEFAULT_CONFIG[category]
    return None


async def get_all_config() -> Dict[str, Any]:
    """获取所有配置，带兜底默认值
    
    Returns:
        完整配置字典，数据库中不存在的配置使用默认值
    """
    result = {}
    
    # 从数据库获取所有配置
    db_manager = get_db_manager()
    if db_manager and db_manager.db:
        rows = await db_manager.fetchall("SELECT key, value, category FROM config")
        for row in rows:
            key = row['key']
            value = row['value']
            category = row['category']
            
            try:
                parsed_value = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                parsed_value = value
            
            if category not in result:
                result[category] = {}
            
            if '.' in key:
                subkey = key.split('.', 1)[1]
                result[category][subkey] = parsed_value
            else:
                result[category] = parsed_value
    
    # 合并默认值，确保所有配置都有值
    for category, defaults in DEFAULT_CONFIG.items():
        if category not in result:
            result[category] = defaults.copy() if isinstance(defaults, dict) else defaults
        elif isinstance(defaults, dict):
            for key, default_value in defaults.items():
                if key not in result[category]:
                    result[category][key] = default_value
    
    return result
