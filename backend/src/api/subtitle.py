from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import json
from datetime import datetime
from ..models.schemas import (
    BaseResponse,
    SubtitleSendRequest,
    SubtitleWindowControlRequest,
    ColorPreset,
    CreateColorPresetRequest,
)
from ..core.database import get_db
from ..core.logger import get_logger

router = APIRouter(prefix="/api/subtitle", tags=["subtitle"])
logger = get_logger(__name__)


@router.get("/config", response_model=BaseResponse)
async def get_subtitle_config():
    try:
        db = get_db()
        rows = await db.fetchall("SELECT key, value FROM config WHERE category = 'subtitle'")
        config = {}
        for row in rows:
            key = row['key'].replace('subtitle.', '')
            try:
                config[key] = json.loads(row['value'])
            except:
                if row['value'].lower() == 'true':
                    config[key] = True
                elif row['value'].lower() == 'false':
                    config[key] = False
                else:
                    try:
                        config[key] = float(row['value'])
                    except:
                        config[key] = row['value']
        return BaseResponse(data=config)
    except Exception as e:
        logger.error(f"Error getting subtitle config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config", response_model=BaseResponse)
async def update_subtitle_config(config: dict):
    try:
        db = get_db()
        for key, value in config.items():
            full_key = f"subtitle.{key}"
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
        return BaseResponse(message="Subtitle config updated")
    except Exception as e:
        logger.error(f"Error updating subtitle config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/color-presets", response_model=BaseResponse)
async def get_color_presets():
    try:
        db = get_db()
        rows = await db.fetchall(
            "SELECT * FROM subtitle_color_presets ORDER BY type, sort_order"
        )
        font = []
        background = []
        for row in rows:
            preset = {
                "id": row['id'],
                "name": row['name'],
                "color": row['color'],
                "type": row['type'],
                "is_custom": bool(row['is_custom']),
            }
            if row['type'] == 'font':
                font.append(preset)
            else:
                background.append(preset)
        return BaseResponse(data={"font": font, "background": background})
    except Exception as e:
        logger.error(f"Error getting color presets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/color-presets", response_model=BaseResponse)
async def add_color_preset(request: CreateColorPresetRequest):
    try:
        db = get_db()
        import uuid
        preset_id = f"custom_{uuid.uuid4().hex[:6]}"
        max_order = await db.fetchone(
            "SELECT MAX(sort_order) as max_order FROM subtitle_color_presets WHERE type = ?",
            (request.type,)
        )
        sort_order = (max_order['max_order'] or 0) + 1
        await db.execute(
            """INSERT INTO subtitle_color_presets
            (id, name, color, type, is_custom, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (preset_id, request.name, request.color, request.type, sort_order)
        )
        return BaseResponse(data={
            "id": preset_id,
            "name": request.name,
            "color": request.color,
            "type": request.type,
        })
    except Exception as e:
        logger.error(f"Error adding color preset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/color-presets/{preset_id}", response_model=BaseResponse)
async def delete_color_preset(preset_id: str):
    try:
        db = get_db()
        existing = await db.fetchone(
            "SELECT * FROM subtitle_color_presets WHERE id = ?", (preset_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Color preset not found")
        if not existing['is_custom']:
            raise HTTPException(status_code=403, detail="Cannot delete builtin preset")
        await db.execute("DELETE FROM subtitle_color_presets WHERE id = ?", (preset_id,))
        return BaseResponse(message="Color preset deleted")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting color preset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send", response_model=BaseResponse)
async def send_subtitle(request: SubtitleSendRequest):
    try:
        db = get_db()
        if request.clear_before:
            await db.execute(
                "UPDATE subtitle_history SET is_cleared = 1, cleared_at = CURRENT_TIMESTAMP WHERE is_cleared = 0"
            )
        await db.execute(
            "INSERT INTO subtitle_history (content, sender) VALUES (?, ?)",
            (request.text, request.sender)
        )
        logger.info(f"Subtitle sent: {request.text[:50]}...")
        return BaseResponse(message="Subtitle sent")
    except Exception as e:
        logger.error(f"Error sending subtitle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear", response_model=BaseResponse)
async def clear_subtitle():
    try:
        db = get_db()
        await db.execute(
            "UPDATE subtitle_history SET is_cleared = 1, cleared_at = CURRENT_TIMESTAMP WHERE is_cleared = 0"
        )
        logger.info("Subtitle cleared")
        return BaseResponse(message="Subtitle cleared")
    except Exception as e:
        logger.error(f"Error clearing subtitle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/window/control", response_model=BaseResponse)
async def control_subtitle_window(request: SubtitleWindowControlRequest):
    try:
        logger.info(f"Subtitle window control: {request.action}")
        return BaseResponse(data={"action": request.action, "success": True})
    except Exception as e:
        logger.error(f"Error controlling subtitle window: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=BaseResponse)
async def get_subtitle_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    try:
        db = get_db()
        rows = await db.fetchall(
            """SELECT id, content, sender, session_id, created_at
            FROM subtitle_history WHERE is_cleared = 0
            ORDER BY created_at DESC LIMIT ? OFFSET ?""",
            (limit, offset)
        )
        history = []
        for row in rows:
            history.append({
                "id": row['id'],
                "content": row['content'],
                "sender": row['sender'],
                "session_id": row['session_id'],
                "created_at": row['created_at'],
            })
        return BaseResponse(data=history)
    except Exception as e:
        logger.error(f"Error getting subtitle history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
