from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from ..models.schemas import BaseResponse, ConfigResponse, UpdateConfigRequest
from ..core.database import get_db
from ..core.logger import get_logger

router = APIRouter(prefix="/api/config", tags=["config"])
logger = get_logger(__name__)


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
            import json
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
                import json
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
async def get_config():
    try:
        config = await _get_config_from_db()
        return BaseResponse(data=config)
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
        logger.info("Config updated successfully")
        return BaseResponse(data=config)
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
