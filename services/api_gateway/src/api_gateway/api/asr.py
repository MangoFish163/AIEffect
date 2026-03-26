from fastapi import APIRouter, HTTPException
import json
import uuid
from datetime import datetime
from ..models.schemas import BaseResponse, ASRConfig, ASRSession
from shared_core import get_db, get_logger

router = APIRouter(prefix="/api/asr", tags=["asr"])
logger = get_logger(__name__)

_asr_sessions = {}


@router.get("/config", response_model=BaseResponse)
async def get_asr_config():
    try:
        db = get_db()
        row = await db.fetchone("SELECT * FROM asr_config WHERE id = 1")
        if not row:
            return BaseResponse(data={
                "enabled": False,
                "provider": "baidu",
                "shortcut": "Ctrl+Shift+,",
                "paste_mode": "direct",
            })
        return BaseResponse(data={
            "enabled": bool(row['enabled']),
            "provider": row['provider'],
            "shortcut": row['shortcut'],
            "paste_mode": row['paste_mode'],
            "baidu_app_id": row['baidu_app_id'],
            "baidu_api_key": row['baidu_api_key'],
            "baidu_secret_key": row['baidu_secret_key'],
            "xunfei_app_id": row['xunfei_app_id'],
            "xunfei_api_key": row['xunfei_api_key'],
            "xunfei_api_secret": row['xunfei_api_secret'],
        })
    except Exception as e:
        logger.error(f"Error getting ASR config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config", response_model=BaseResponse)
async def update_asr_config(config: dict):
    try:
        db = get_db()
        await db.execute(
            """UPDATE asr_config SET
            enabled = ?, provider = ?, shortcut = ?, paste_mode = ?,
            baidu_app_id = ?, baidu_api_key = ?, baidu_secret_key = ?,
            xunfei_app_id = ?, xunfei_api_key = ?, xunfei_api_secret = ?,
            updated_at = CURRENT_TIMESTAMP WHERE id = 1""",
            (
                config.get('enabled', False),
                config.get('provider', 'baidu'),
                config.get('shortcut', 'Ctrl+Shift+,'),
                config.get('paste_mode', 'direct'),
                config.get('baidu_app_id'),
                config.get('baidu_api_key'),
                config.get('baidu_secret_key'),
                config.get('xunfei_app_id'),
                config.get('xunfei_api_key'),
                config.get('xunfei_api_secret'),
            )
        )
        return BaseResponse(message="ASR config updated")
    except Exception as e:
        logger.error(f"Error updating ASR config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start", response_model=BaseResponse)
async def start_asr():
    try:
        session_id = f"asr_{uuid.uuid4().hex[:8]}"
        _asr_sessions[session_id] = {
            "status": "listening",
            "started_at": datetime.now(),
        }
        logger.info(f"ASR started: {session_id}")
        return BaseResponse(data={
            "session_id": session_id,
            "status": "listening",
        })
    except Exception as e:
        logger.error(f"Error starting ASR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop", response_model=BaseResponse)
async def stop_asr():
    try:
        for session_id in list(_asr_sessions.keys()):
            _asr_sessions[session_id]["status"] = "stopped"
        logger.info("ASR stopped")
        return BaseResponse(message="ASR stopped")
    except Exception as e:
        logger.error(f"Error stopping ASR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
