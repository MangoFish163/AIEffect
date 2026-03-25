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
    curl_example TEXT,                   -- cURL 示例代码
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
    sort_order INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 字幕历史表
CREATE TABLE IF NOT EXISTS subtitle_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    sender TEXT DEFAULT 'assistant',
    session_id TEXT,
    is_cleared BOOLEAN DEFAULT 0,
    cleared_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 角色记忆表
CREATE TABLE IF NOT EXISTS character_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL UNIQUE,
    message_count INTEGER DEFAULT 0,
    compressed_summary TEXT,
    summary_tokens INTEGER,
    last_message_id INTEGER,
    last_compressed_at TIMESTAMP,
    compression_count INTEGER DEFAULT 0,
    extra_data TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- 对话消息表
CREATE TABLE IF NOT EXISTS conversation_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    speaker TEXT,
    content TEXT NOT NULL,
    tokens INTEGER,
    is_compressed BOOLEAN DEFAULT 0,
    compressed_batch_id INTEGER,
    session_id TEXT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- 记忆压缩历史表
CREATE TABLE IF NOT EXISTS memory_compression_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    original_count INTEGER,
    retained_count INTEGER,
    compressed_count INTEGER,
    summary TEXT,
    backup_path TEXT,
    prompt_used TEXT,
    model_used TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
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
    exception_traceback TEXT
);

-- ASR配置表
CREATE TABLE IF NOT EXISTS asr_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled BOOLEAN DEFAULT 0,
    provider TEXT DEFAULT 'baidu',
    shortcut TEXT DEFAULT 'Ctrl+Shift+,',
    paste_mode TEXT DEFAULT 'direct',
    baidu_app_id TEXT,
    baidu_api_key TEXT,
    baidu_secret_key TEXT,
    xunfei_app_id TEXT,
    xunfei_api_key TEXT,
    xunfei_api_secret TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agents表
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT,
    role TEXT,
    avatar TEXT DEFAULT '🤖',
    color TEXT DEFAULT '#6366f1',
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    direction TEXT DEFAULT 'down',
    status TEXT DEFAULT 'idle',
    status_message TEXT,
    is_active BOOLEAN DEFAULT 1,
    assigned_zone TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent消息表
CREATE TABLE IF NOT EXISTS agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    content TEXT NOT NULL,
    sender TEXT NOT NULL,
    response TEXT,
    session_id TEXT,
    tokens_used INTEGER,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- 工作室区域表
CREATE TABLE IF NOT EXISTS agent_zones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 1,
    height INTEGER DEFAULT 1,
    icon TEXT DEFAULT '📍',
    sort_order INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT 1,
    extra_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 角色管理表
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    save_id TEXT,
    ai_soul TEXT,
    ai_voice TEXT,
    avatar_url TEXT,
    token_usage INTEGER DEFAULT 0,
    chat_count INTEGER DEFAULT 0,
    compression_enabled BOOLEAN DEFAULT 0,
    interaction_ops TEXT DEFAULT '[]',
    extra_data TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_config_category ON config(category);
CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);
CREATE INDEX IF NOT EXISTS idx_provider_presets_custom ON provider_presets(is_custom);
CREATE INDEX IF NOT EXISTS idx_provider_presets_builtin ON provider_presets(is_builtin);
CREATE INDEX IF NOT EXISTS idx_tts_engines_enabled ON tts_engines(is_enabled);
CREATE INDEX IF NOT EXISTS idx_voice_characters_engine ON voice_characters(engine_id);
CREATE INDEX IF NOT EXISTS idx_voice_characters_default ON voice_characters(is_default);
CREATE INDEX IF NOT EXISTS idx_character_emotions_character ON character_emotions(character_id);
CREATE INDEX IF NOT EXISTS idx_subtitle_color_presets_type ON subtitle_color_presets(type);
CREATE INDEX IF NOT EXISTS idx_subtitle_history_created ON subtitle_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subtitle_history_session ON subtitle_history(session_id);
CREATE INDEX IF NOT EXISTS idx_character_memories_character_id ON character_memories(character_id);
CREATE INDEX IF NOT EXISTS idx_character_memories_updated ON character_memories(updated_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_character ON conversation_messages(character_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created ON conversation_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_compressed ON conversation_messages(is_compressed);
CREATE INDEX IF NOT EXISTS idx_memory_compression_character ON memory_compression_history(character_id);
CREATE INDEX IF NOT EXISTS idx_memory_compression_created ON memory_compression_history(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_module ON system_logs(module);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_zone ON agents(assigned_zone);
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_messages_agent ON agent_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_zones_type ON agent_zones(type);
CREATE INDEX IF NOT EXISTS idx_characters_save_id ON characters(save_id);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);
CREATE INDEX IF NOT EXISTS idx_characters_created ON characters(created_at);
"""

DEFAULT_CONFIG_DATA = [
    ('api.provider', '"deepseek"', 'api', '当前使用的服务商'),
    ('api.api_url', '"https://api.deepseek.com/v1"', 'api', 'API 基础 URL'),
    ('api.api_key', '""', 'api', 'API 密钥'),
    ('api.model_name', '"deepseek-chat"', 'api', '模型名称'),
    ('tts.enabled', 'true', 'tts', '是否启用 TTS'),
    ('tts.engine', '"gpt_sovits"', 'tts', 'TTS 引擎'),
    ('tts.volume', '0.8', 'tts', '音量 0-1'),
    ('tts.auto_play', 'true', 'tts', '自动播放'),
    ('tts.save_audio', 'true', 'tts', '保存音频文件'),
    ('tts.play_mode', '"dialog"', 'tts', '播放模式: dialog/full'),
    ('subtitle.font_color', '"#ffffff"', 'subtitle', '字体颜色'),
    ('subtitle.background_color', '"#0a0a0f"', 'subtitle', '背景颜色'),
    ('subtitle.opacity', '0.9', 'subtitle', '不透明度 0-1'),
    ('subtitle.font_size', '16', 'subtitle', '字体大小'),
    ('subtitle.typing_speed', '30', 'subtitle', '打字速度(ms)'),
    ('subtitle.is_visible', 'true', 'subtitle', '字幕是否可见'),
    ('subtitle.controls_hidden', 'false', 'subtitle', '控件是否隐藏'),
    ('memory.save_dir', '"./data/memories"', 'memory', '存档目录'),
    ('memory.trigger_threshold', '300', 'memory', '触发压缩阈值'),
    ('memory.compress_count', '50', 'memory', '压缩后保留条数'),
    ('memory.check_frequency', '30', 'memory', '检查频率'),
    ('memory.auto_compress', 'false', 'memory', '自动压缩'),
    ('memory.backup_before_compress', 'true', 'memory', '压缩前备份'),
    ('memory.compress_prompt', '"请用简洁的语言总结{character_name}和{player_name}之间的对话历史。当前共有{message_count}条消息。"', 'memory', '压缩提示词模板'),
    ('ports.api', '8500', 'ports', 'API 服务端口'),
    ('ports.ollama_proxy', '8501', 'ports', 'Ollama 代理端口'),
    ('ports.websocket', '8502', 'ports', 'WebSocket 端口'),
    ('ports.subtitle', '8503', 'ports', '字幕服务端口'),
    ('ports.tts', '8504', 'ports', 'TTS 服务端口'),
    ('ports.log', '8505', 'ports', '日志服务端口'),
    ('lan_enabled', 'false', 'general', '局域网访问开关'),
    ('theme', '"light"', 'general', '主题: light/dark'),
    ('language', '"zh-CN"', 'general', '界面语言'),
]

DEFAULT_PROVIDER_PRESETS = [
    ('deepseek', 'DeepSeek', '🗿', 'https://api.deepseek.com/v1', 1, 1),
    ('doubao', '豆包Seed (火山引擎)', '😍', 'https://ark.cn-beijing.volces.com/api/v3', 1, 2),
    ('mimo', 'MiMo (XiaoMi)', '🐿️', 'https://api.mimo.ai/v1', 1, 3),
    ('openrouter', 'OpenRouter', '🤖', 'https://openrouter.ai/api/v1', 1, 4),
    ('openai', 'OpenAI', '🐳', 'https://api.openai.com/v1', 1, 5),
    ('local', '本地模型', '🏠', 'http://127.0.0.1:11434/v1', 1, 6),
]

DEFAULT_TTS_ENGINES = [
    ('gpt_sovits', 'GPT-SoVITS', 1, 1, json.dumps({
        "api_url": "http://localhost:9880/tts",
        "inference_params": {"top_k": 40, "top_p": 0.9, "temperature": 1.3},
        "reference_audio": {"min_count": 2, "max_count": 3, "emotion_threshold": 0.3}
    })),
    ('xunfei', '讯飞语音', 1, 2, json.dumps({
        "app_id": "", "api_key": "", "api_secret": "", "voice": "x4_yezi"
    })),
]

DEFAULT_COLOR_PRESETS = [
    ('white', '白色', '#ffffff', 'font', 0, 1),
    ('black', '黑色', '#000000', 'font', 0, 2),
    ('pink', '粉色', '#ec4899', 'font', 0, 3),
    ('yellow', '黄色', '#eab308', 'font', 0, 4),
    ('cyan', '青色', '#06b6d4', 'font', 0, 5),
    ('gold', '金色', '#f59e0b', 'font', 0, 6),
    ('darkblue', '深蓝灰', '#475569', 'font', 0, 7),
    ('aurora', '科技极光', '#6366f1', 'background', 0, 1),
    ('dark', '深色', '#0a0a0f', 'background', 0, 2),
    ('light', '浅色', '#f8fafc', 'background', 0, 3),
]

DEFAULT_AGENTS = [
    ('agent_001', 'Jarvis', '贾维斯', '值班SRE', '🤖', '#e07a5f', 2, 3, 'down', 'working', 'work_sre'),
    ('agent_002', 'Monica', '莫妮卡', '开发', '👩‍💻', '#3d405b', 2, 6, 'down', 'idle', 'work_dev'),
    ('agent_003', 'Lobster', '龙虾', '休息中', '🦞', '#f4a261', 7, 5, 'right', 'idle', 'rest_area'),
    ('agent_004', 'Cat', '猫咪', '测试', '🐱', '#81b29a', 10, 2, 'down', 'working', 'work_test'),
    ('agent_005', 'Bug', '虫子', '安全', '🐛', '#f2cc8f', 13, 3, 'left', 'idle', 'work_security'),
]

DEFAULT_AGENT_ZONES = [
    ('work_sre', '日志管理区', 'work', 'SRE 值班工位', 1, 2, 3, 3, '🖥️', 1),
    ('work_dev', '开发工作区', 'work', '开发工位', 1, 5, 3, 3, '💻', 2),
    ('work_test', '测试工作区', 'work', '测试工位', 13, 2, 3, 3, '🧪', 3),
    ('work_memory', '记忆管理区', 'work', '两列图书柜', 14, 6, 2, 4, '📚', 4),
    ('work_voice', '语音配置区', 'work', '音乐台', 5, 1, 4, 2, '🎵', 5),
    ('work_subtitle', '字幕视觉区', 'work', '大彩电', 10, 8, 4, 3, '📺', 6),
    ('work_boss', 'Boss 巡查室', 'work', '单独小房间', 0, 8, 3, 3, '👔', 7),
    ('rest_area', '休息区', 'rest', '饮水机、音乐舞台、牌桌', 6, 4, 4, 4, '☕', 8),
    ('hall', '大厅', 'hall', '待命区域', 8, 8, 6, 3, '🏛️', 9),
]


class Database:
    _instance: Optional['Database'] = None
    _db: Optional[aiosqlite.Connection] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def init(self):
        if self._db is None:
            db_path = Path(DATABASE_FILE)
            db_path.parent.mkdir(parents=True, exist_ok=True)
            self._db = await aiosqlite.connect(DATABASE_FILE)
            self._db.row_factory = aiosqlite.Row
            await self._init_tables()
            await self._init_default_data()
            logger.info("Database initialized")

    async def _init_tables(self):
        await self._db.executescript(INIT_SQL)
        await self._db.commit()
        # 执行迁移：添加 curl_example 字段到 provider_presets 表
        await self._migrate_add_curl_example()

    async def _migrate_add_curl_example(self):
        """迁移：为 provider_presets 表添加 curl_example 字段"""
        try:
            # 检查字段是否已存在
            cursor = await self._db.execute("PRAGMA table_info(provider_presets)")
            columns = await cursor.fetchall()
            column_names = [col['name'] for col in columns]

            if 'curl_example' not in column_names:
                await self._db.execute(
                    "ALTER TABLE provider_presets ADD COLUMN curl_example TEXT"
                )
                await self._db.commit()
                logger.info("Migration applied: Added curl_example column to provider_presets")
        except Exception as e:
            logger.error(f"Migration failed for curl_example: {e}")

    async def _init_default_data(self):
        cursor = await self._db.execute("SELECT COUNT(*) as count FROM config")
        row = await cursor.fetchone()
        if row['count'] == 0:
            await self._db.executemany(
                "INSERT INTO config (key, value, category, description) VALUES (?, ?, ?, ?)",
                DEFAULT_CONFIG_DATA
            )
            await self._db.commit()
            logger.info("Default config data inserted")

        cursor = await self._db.execute("SELECT COUNT(*) as count FROM provider_presets")
        row = await cursor.fetchone()
        if row['count'] == 0:
            await self._db.executemany(
                "INSERT INTO provider_presets (id, name, icon, api_url, is_builtin, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
                DEFAULT_PROVIDER_PRESETS
            )
            await self._db.commit()
            logger.info("Default provider presets inserted")

        cursor = await self._db.execute("SELECT COUNT(*) as count FROM tts_engines")
        row = await cursor.fetchone()
        if row['count'] == 0:
            await self._db.executemany(
                "INSERT INTO tts_engines (id, name, is_enabled, priority, config) VALUES (?, ?, ?, ?, ?)",
                DEFAULT_TTS_ENGINES
            )
            await self._db.commit()
            logger.info("Default TTS engines inserted")

        cursor = await self._db.execute("SELECT COUNT(*) as count FROM subtitle_color_presets")
        row = await cursor.fetchone()
        if row['count'] == 0:
            await self._db.executemany(
                "INSERT INTO subtitle_color_presets (id, name, color, type, is_custom, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
                DEFAULT_COLOR_PRESETS
            )
            await self._db.commit()
            logger.info("Default color presets inserted")

        cursor = await self._db.execute("SELECT COUNT(*) as count FROM agents")
        row = await cursor.fetchone()
        if row['count'] == 0:
            await self._db.executemany(
                """INSERT INTO agents (id, name, display_name, role, avatar, color, position_x, position_y, direction, status, assigned_zone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                DEFAULT_AGENTS
            )
            await self._db.commit()
            logger.info("Default agents inserted")

        cursor = await self._db.execute("SELECT COUNT(*) as count FROM agent_zones")
        row = await cursor.fetchone()
        if row['count'] == 0:
            await self._db.executemany(
                """INSERT INTO agent_zones (id, name, type, description, position_x, position_y, width, height, icon, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                DEFAULT_AGENT_ZONES
            )
            await self._db.commit()
            logger.info("Default agent zones inserted")

        cursor = await self._db.execute("SELECT COUNT(*) as count FROM asr_config")
        row = await cursor.fetchone()
        if row['count'] == 0:
            await self._db.execute(
                "INSERT INTO asr_config (id, enabled, provider) VALUES (1, 0, 'baidu')"
            )
            await self._db.commit()
            logger.info("Default ASR config inserted")

    async def execute(self, query: str, parameters: tuple = ()):
        async with self._db.execute(query, parameters) as cursor:
            await self._db.commit()
            return cursor.lastrowid

    async def fetchone(self, query: str, parameters: tuple = ()):
        async with self._db.execute(query, parameters) as cursor:
            return await cursor.fetchone()

    async def fetchall(self, query: str, parameters: tuple = ()):
        async with self._db.execute(query, parameters) as cursor:
            return await cursor.fetchall()

    async def execute_many(self, query: str, parameters: List[tuple]):
        await self._db.executemany(query, parameters)
        await self._db.commit()

    async def close(self):
        if self._db:
            await self._db.close()
            self._db = None
            logger.info("Database closed")


def get_db() -> Database:
    return Database()
