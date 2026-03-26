from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional
from ..models.schemas import BaseResponse, ConfigResponse, UpdateConfigRequest
from shared_core import get_db, get_logger, get_all_config, DEFAULT_CONFIG
import hashlib
import json

router = APIRouter(prefix="/api/config", tags=["config"])
logger = get_logger(__name__)


def generate_config_hash(config: Dict[str, Any]) -> str:
    """生成配置的hash值（定长16位十六进制字符串）"""
    # 只取api配置进行hash
    api_config = config.get('api', {})
    # 按key排序确保一致性
    sorted_config = json.dumps(api_config, sort_keys=True, ensure_ascii=False)
    # 使用SHA256生成hash，取前16位
    hash_value = hashlib.sha256(sorted_config.encode('utf-8')).hexdigest()[:16]
    return hash_value


async def _get_config_from_db() -> Dict[str, Any]:
    """从数据库获取配置，带兜底默认值
    
    优先使用 shared_core 的 get_all_config 函数，
    确保即使数据库为空也能返回有效配置
    """
    return await get_all_config()


async def _init_default_config():
    """初始化默认配置到数据库（幂等操作）
    
    使用 INSERT OR IGNORE 确保重复执行不会报错，
    不会覆盖用户已修改的配置
    """
    db = get_db()
    default_configs = [
        # API配置
        ('api.provider', json.dumps('local'), 'api', 'API提供商'),
        ('api.api_url', json.dumps('http://127.0.0.1:11434/v1'), 'api', 'API地址'),
        ('api.api_key', json.dumps(''), 'api', 'API密钥'),
        ('api.model_name', json.dumps(''), 'api', '模型名称'),
        # TTS配置
        ('tts.enabled', 'true', 'tts', '是否启用TTS'),
        ('tts.engine', json.dumps('gpt_sovits'), 'tts', 'TTS引擎'),
        ('tts.volume', '0.8', 'tts', '音量'),
        ('tts.auto_play', 'true', 'tts', '自动播放'),
        ('tts.save_audio', 'true', 'tts', '保存音频'),
        ('tts.play_mode', json.dumps('dialog'), 'tts', '播放模式'),
        # 字幕配置
        ('subtitle.font_color', json.dumps('#ffffff'), 'subtitle', '字体颜色'),
        ('subtitle.background_color', json.dumps('#0a0a0f'), 'subtitle', '背景颜色'),
        ('subtitle.opacity', '0.9', 'subtitle', '透明度'),
        ('subtitle.font_size', '16', 'subtitle', '字体大小'),
        ('subtitle.typing_speed', '30', 'subtitle', '打字速度'),
        ('subtitle.is_visible', 'true', 'subtitle', '是否可见'),
        ('subtitle.controls_hidden', 'false', 'subtitle', '控制按钮隐藏'),
        # 记忆配置
        ('memory.save_dir', json.dumps('./data/memories'), 'memory', '保存目录'),
        ('memory.trigger_threshold', '300', 'memory', '触发阈值'),
        ('memory.compress_count', '50', 'memory', '压缩数量'),
        ('memory.check_frequency', '30', 'memory', '检查频率'),
        ('memory.auto_compress', 'false', 'memory', '自动压缩'),
        ('memory.backup_before_compress', 'true', 'memory', '压缩前备份'),
        ('memory.compress_prompt', json.dumps('请用简洁的语言总结{character_name}和{player_name}之间的对话历史。当前共有{message_count}条消息。'), 'memory', '压缩提示词'),
        # 端口配置
        ('ports.frontend', '8500', 'ports', '前端端口'),
        ('ports.api', '8501', 'ports', 'API端口'),
        ('ports.ollama_proxy', '11434', 'ports', 'Ollama代理端口'),
        ('ports.websocket', '8502', 'ports', 'WebSocket端口'),
        ('ports.subtitle', '8503', 'ports', '字幕端口'),
        ('ports.tts', '8504', 'ports', 'TTS端口'),
        ('ports.log', '8505', 'ports', '日志端口'),
        # LAN配置
        ('lan_enabled', 'false', 'general', '是否启用局域网'),
    ]
    
    inserted_count = 0
    for key, value, category, description in default_configs:
        # 使用 INSERT OR IGNORE 实现幂等性
        # 如果key已存在，不会插入也不会更新
        cursor = await db.execute(
            """INSERT OR IGNORE INTO config (key, value, category, description, updated_at, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (key, value, category, description)
        )
        if cursor and cursor.rowcount > 0:
            inserted_count += 1
    
    if inserted_count > 0:
        logger.info(f"Default config initialized: {inserted_count} new entries")
    else:
        logger.debug("Default config already exists, skipping initialization")


async def _update_config_in_db(updates: Dict[str, Any]):
    db = get_db()
    for section, values in updates.items():
        if section == 'lan_enabled':
            await db.execute(
                """INSERT INTO config (key, value, category, updated_at, created_at)
                VALUES (?, ?, 'general', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP""",
                ('lan_enabled', str(values).lower())
            )
        elif isinstance(values, dict):
            for key, value in values.items():
                full_key = f"{section}.{key}"
                if isinstance(value, (dict, list)):
                    str_value = json.dumps(value, ensure_ascii=False)
                elif isinstance(value, bool):
                    str_value = str(value).lower()
                else:
                    str_value = str(value)
                await db.execute(
                    """INSERT INTO config (key, value, category, updated_at, created_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP""",
                    (full_key, str_value, section)
                )


@router.get("", response_model=BaseResponse)
async def get_config(hash: Optional[str] = Query(None, description="前端缓存的hash值")):
    """获取配置，支持hash校验
    
    Args:
        hash: 前端缓存的配置hash值，如果提供则进行比对
        
    Returns:
        如果hash匹配，只返回hash_mismatch=false
        如果hash不匹配或未提供hash，返回完整配置和server_hash
    """
    try:
        config = await _get_config_from_db()
        server_hash = generate_config_hash(config)
        
        # 如果提供了hash且匹配，返回简化响应
        if hash and hash == server_hash:
            return BaseResponse(data={"hash_mismatch": False}, server_hash=server_hash)
        
        # hash不匹配或未提供，返回完整配置
        return BaseResponse(
            data=config,
            server_hash=server_hash,
            hash_mismatch=True
        )
    except Exception as e:
        logger.error(f"Error getting config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("", response_model=BaseResponse)
async def update_config(request: UpdateConfigRequest):
    try:
        updates = {}
        if request.api is not None:
            updates['api'] = request.api
        if request.tts is not None:
            updates['tts'] = request.tts
        if request.subtitle is not None:
            updates['subtitle'] = request.subtitle
        if request.memory is not None:
            updates['memory'] = request.memory
        if request.lan_enabled is not None:
            updates['lan_enabled'] = request.lan_enabled
        await _update_config_in_db(updates)
        config = await _get_config_from_db()
        server_hash = generate_config_hash(config)
        logger.info("Config updated successfully")
        return BaseResponse(data=config, server_hash=server_hash)
    except Exception as e:
        logger.error(f"Error updating config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset", response_model=BaseResponse)
async def reset_config():
    try:
        db = get_db()
        await db.execute("DELETE FROM config")
        await _init_default_config()
        config = await _get_config_from_db()
        logger.info("Config reset to default")
        return BaseResponse(data=config)
    except Exception as e:
        logger.error(f"Error resetting config: {e}")
        raise HTTPException(status_code=500, detail=str(e))
