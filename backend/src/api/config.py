from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional
from ..models.schemas import BaseResponse, ConfigResponse, UpdateConfigRequest
from ..core.database import get_db
from ..core.logger import get_logger
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
    db = get_db()
    rows = await db.fetchall("SELECT key, value, category FROM config")
    config = {
        "api": {},
        "tts": {},
        "subtitle": {},
        "memory": {},
        "ports": {},
        "lan_enabled": False,
    }
    for row in rows:
        key = row['key']
        value = row['value']
        category = row['category']
        try:
            parsed_value = json.loads(value)
        except:
            parsed_value = value
        if key == 'lan_enabled':
            config['lan_enabled'] = parsed_value if isinstance(parsed_value, bool) else parsed_value == 'true'
        elif '.' in key:
            section, subkey = key.split('.', 1)
            if section in config:
                config[section][subkey] = parsed_value
    return config


async def _update_config_in_db(updates: Dict[str, Any]):
    db = get_db()
    for section, values in updates.items():
        if section == 'lan_enabled':
            await db.execute(
                "UPDATE config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
                (str(values).lower(), 'lan_enabled')
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
                    "UPDATE config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
                    (str_value, full_key)
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
        await db._init_default_data()
        config = await _get_config_from_db()
        logger.info("Config reset to default")
        return BaseResponse(data=config)
    except Exception as e:
        logger.error(f"Error resetting config: {e}")
        raise HTTPException(status_code=500, detail=str(e))
