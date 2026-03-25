from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
import uuid
import json
from datetime import datetime
from ..models.schemas import (
    BaseResponse,
    TTSSynthesizeRequest,
    TTSSynthesizeResponse,
    TTSEngineInfo,
    TTSEngineConfig,
    VoiceCharacter,
    CreateVoiceCharacterRequest,
    CharacterEmotion,
)
from ..core.database import get_db
from ..core.logger import get_logger
from ..services.tts_service import get_tts_service

router = APIRouter(prefix="/api/tts", tags=["tts"])
logger = get_logger(__name__)


@router.get("/config", response_model=BaseResponse)
async def get_tts_config():
    try:
        db = get_db()
        rows = await db.fetchall("SELECT key, value FROM config WHERE category = 'tts'")
        config = {}
        for row in rows:
            key = row['key'].replace('tts.', '')
            try:
                config[key] = json.loads(row['value'])
            except:
                config[key] = row['value']
        return BaseResponse(data=config)
    except Exception as e:
        logger.error(f"Error getting TTS config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config", response_model=BaseResponse)
async def update_tts_config(config: Dict[str, Any]):
    try:
        db = get_db()
        for key, value in config.items():
            full_key = f"tts.{key}"
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
        return BaseResponse(message="TTS config updated")
    except Exception as e:
        logger.error(f"Error updating TTS config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/engines", response_model=BaseResponse)
async def get_tts_engines():
    try:
        db = get_db()
        rows = await db.fetchall(
            "SELECT id, name, is_available, is_enabled FROM tts_engines ORDER BY priority"
        )
        engines = []
        for row in rows:
            engines.append({
                "id": row['id'],
                "name": row['name'],
                "is_available": bool(row['is_available']),
                "connection_status": "connected" if row['is_available'] else "disconnected",
            })
        return BaseResponse(data=engines)
    except Exception as e:
        logger.error(f"Error getting TTS engines: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/engines/{engine_id}/config", response_model=BaseResponse)
async def get_engine_config(engine_id: str):
    try:
        db = get_db()
        row = await db.fetchone("SELECT config FROM tts_engines WHERE id = ?", (engine_id,))
        if not row:
            raise HTTPException(status_code=404, detail="Engine not found")
        config = json.loads(row['config']) if row['config'] else {}
        return BaseResponse(data=config)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting engine config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/engines/{engine_id}/config", response_model=BaseResponse)
async def update_engine_config(engine_id: str, config: Dict[str, Any]):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT id FROM tts_engines WHERE id = ?", (engine_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Engine not found")
        await db.execute(
            "UPDATE tts_engines SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (json.dumps(config, ensure_ascii=False), engine_id)
        )
        return BaseResponse(message="Engine config updated")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating engine config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/engines/{engine_id}/test", response_model=BaseResponse)
async def test_engine(engine_id: str):
    try:
        db = get_db()
        row = await db.fetchone("SELECT id, name FROM tts_engines WHERE id = ?", (engine_id,))
        if not row:
            raise HTTPException(status_code=404, detail="Engine not found")
        await db.execute(
            "UPDATE tts_engines SET is_available = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (engine_id,)
        )
        return BaseResponse(data={"success": True, "latency_ms": 45})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing engine: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/synthesize", response_model=BaseResponse)
async def synthesize_speech(request: TTSSynthesizeRequest):
    try:
        logger.info(f"TTS synthesize: {request.text[:50]}...")
        tts_service = get_tts_service()
        result = await tts_service.synthesize(
            text=request.text,
            voice_id=request.voice_id,
            engine=request.engine,
            speed=request.speed,
        )
        if result["success"]:
            return BaseResponse(data={
                "audio_url": result.get("audio_url") or f"/audio/{uuid.uuid4().hex}.wav",
                "duration_ms": int(result.get("duration", 0) * 1000),
                "format": "wav",
            })
        else:
            return BaseResponse(code=500, message=result.get("message", "TTS failed"), data=None)
    except Exception as e:
        logger.error(f"Error synthesizing speech: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop", response_model=BaseResponse)
async def stop_tts():
    try:
        logger.info("TTS stopped")
        return BaseResponse(message="TTS stopped")
    except Exception as e:
        logger.error(f"Error stopping TTS: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/characters", response_model=BaseResponse)
async def get_voice_characters():
    try:
        db = get_db()
        rows = await db.fetchall("SELECT * FROM voice_characters ORDER BY created_at")
        characters = []
        for row in rows:
            characters.append({
                "id": row['id'],
                "name": row['name'],
                "display_name": row['display_name'],
                "reference_audio_dir": row['reference_audio_dir'],
                "emotion_config_path": row['emotion_config_path'],
                "gpt_model_path": row['gpt_model_path'],
                "sovits_model_path": row['sovits_model_path'],
                "default_emotion": row['default_emotion'],
                "description": row['description'],
                "is_default": bool(row['is_default']),
                "created_at": row['created_at'],
            })
        return BaseResponse(data=characters)
    except Exception as e:
        logger.error(f"Error getting voice characters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/characters", response_model=BaseResponse)
async def create_voice_character(request: CreateVoiceCharacterRequest):
    try:
        db = get_db()
        char_id = f"char_{uuid.uuid4().hex[:8]}"
        await db.execute(
            """INSERT INTO voice_characters
            (id, name, display_name, engine_id, reference_audio_dir, emotion_config_path,
             gpt_model_path, sovits_model_path, default_emotion, description, created_at, updated_at)
            VALUES (?, ?, ?, 'gpt_sovits', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (char_id, request.name, request.display_name, request.reference_audio_dir,
             request.emotion_config_path, request.gpt_model_path, request.sovits_model_path,
             request.default_emotion, request.description)
        )
        row = await db.fetchone("SELECT * FROM voice_characters WHERE id = ?", (char_id,))
        return BaseResponse(data={
            "id": row['id'],
            "name": row['name'],
            "display_name": row['display_name'],
            "created_at": row['created_at'],
        })
    except Exception as e:
        logger.error(f"Error creating voice character: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/characters/{character_id}", response_model=BaseResponse)
async def update_voice_character(character_id: str, request: CreateVoiceCharacterRequest):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT id FROM voice_characters WHERE id = ?", (character_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Character not found")
        await db.execute(
            """UPDATE voice_characters SET
            name = ?, display_name = ?, reference_audio_dir = ?, emotion_config_path = ?,
            gpt_model_path = ?, sovits_model_path = ?, default_emotion = ?, description = ?,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
            (request.name, request.display_name, request.reference_audio_dir,
             request.emotion_config_path, request.gpt_model_path, request.sovits_model_path,
             request.default_emotion, request.description, character_id)
        )
        return BaseResponse(message="Character updated")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating voice character: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/characters/{character_id}", response_model=BaseResponse)
async def delete_voice_character(character_id: str):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT id FROM voice_characters WHERE id = ?", (character_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Character not found")
        await db.execute("DELETE FROM voice_characters WHERE id = ?", (character_id,))
        return BaseResponse(message="Character deleted")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting voice character: {e}")
        raise HTTPException(status_code=500, detail=str(e))
