from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import json
import uuid
from datetime import datetime
from ..models.schemas import (
    BaseResponse,
    GameCharacter,
    CreateGameCharacterRequest,
    UpdateGameCharacterRequest,
    ImportCharacterRequest,
    PaginationData,
)
from shared_core import get_db, get_logger

router = APIRouter(prefix="/api/characters", tags=["characters"])
logger = get_logger(__name__)


def generate_ulid() -> str:
    return uuid.uuid4().hex[:26].upper()


def parse_interaction_ops(value: Any) -> List[str]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except:
            return []
    return []


def parse_extra_data(value: Any) -> Optional[Dict[str, Any]]:
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except:
            return None
    return None


@router.get("", response_model=BaseResponse)
async def get_characters(
    save_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    try:
        db = get_db()
        conditions = []
        params = []

        if save_id:
            conditions.append("save_id = ?")
            params.append(save_id)

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        count_sql = f"SELECT COUNT(*) as count FROM characters {where_clause}"
        row = await db.fetchone(count_sql, tuple(params))
        total = row['count'] if row else 0

        offset = (page - 1) * page_size
        data_sql = f"""SELECT * FROM characters {where_clause}
                      ORDER BY updated_at DESC LIMIT ? OFFSET ?"""
        rows = await db.fetchall(data_sql, tuple(params + [page_size, offset]))

        items = []
        for row in rows:
            items.append({
                "id": row['id'],
                "name": row['name'],
                "save_id": row['save_id'],
                "ai_soul": row['ai_soul'],
                "ai_voice": row['ai_voice'],
                "avatar_url": row['avatar_url'],
                "token_usage": row['token_usage'] or 0,
                "chat_count": row['chat_count'] or 0,
                "compression_enabled": bool(row['compression_enabled']),
                "interaction_ops": parse_interaction_ops(row['interaction_ops']),
                "extra_data": parse_extra_data(row['extra_data']),
                "created_at": row['created_at'],
                "updated_at": row['updated_at'],
            })

        total_pages = (total + page_size - 1) // page_size

        return BaseResponse(data={
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        })
    except Exception as e:
        logger.error(f"Error getting characters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=BaseResponse)
async def create_character(request: CreateGameCharacterRequest):
    try:
        db = get_db()
        character_id = generate_ulid()

        await db.execute(
            """INSERT INTO characters
            (id, name, save_id, ai_soul, ai_voice, avatar_url,
             compression_enabled, interaction_ops, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (
                character_id,
                request.name,
                request.save_id,
                request.ai_soul,
                request.ai_voice,
                request.avatar_url,
                1 if request.compression_enabled else 0,
                json.dumps(request.interaction_ops, ensure_ascii=False),
            )
        )

        await db.execute(
            """INSERT INTO character_memories
            (character_id, message_count, compression_count, created_at, updated_at)
            VALUES (?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (character_id,)
        )

        row = await db.fetchone("SELECT * FROM characters WHERE id = ?", (character_id,))
        return BaseResponse(data={
            "id": row['id'],
            "name": row['name'],
            "save_id": row['save_id'],
            "ai_soul": row['ai_soul'],
            "ai_voice": row['ai_voice'],
            "avatar_url": row['avatar_url'],
            "compression_enabled": bool(row['compression_enabled']),
            "interaction_ops": parse_interaction_ops(row['interaction_ops']),
            "created_at": row['created_at'],
            "updated_at": row['updated_at'],
        })
    except Exception as e:
        logger.error(f"Error creating character: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{character_id}", response_model=BaseResponse)
async def get_character(character_id: str):
    try:
        db = get_db()
        row = await db.fetchone("SELECT * FROM characters WHERE id = ?", (character_id,))
        if not row:
            raise HTTPException(status_code=404, detail="Character not found")

        return BaseResponse(data={
            "id": row['id'],
            "name": row['name'],
            "save_id": row['save_id'],
            "ai_soul": row['ai_soul'],
            "ai_voice": row['ai_voice'],
            "avatar_url": row['avatar_url'],
            "token_usage": row['token_usage'] or 0,
            "chat_count": row['chat_count'] or 0,
            "compression_enabled": bool(row['compression_enabled']),
            "interaction_ops": parse_interaction_ops(row['interaction_ops']),
            "extra_data": parse_extra_data(row['extra_data']),
            "created_at": row['created_at'],
            "updated_at": row['updated_at'],
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting character: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{character_id}", response_model=BaseResponse)
async def update_character(character_id: str, request: UpdateGameCharacterRequest):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT id FROM characters WHERE id = ?", (character_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Character not found")

        updates = []
        params = []

        if request.name is not None:
            updates.append("name = ?")
            params.append(request.name)
        if request.save_id is not None:
            updates.append("save_id = ?")
            params.append(request.save_id)
        if request.ai_soul is not None:
            updates.append("ai_soul = ?")
            params.append(request.ai_soul)
        if request.ai_voice is not None:
            updates.append("ai_voice = ?")
            params.append(request.ai_voice)
        if request.avatar_url is not None:
            updates.append("avatar_url = ?")
            params.append(request.avatar_url)
        if request.compression_enabled is not None:
            updates.append("compression_enabled = ?")
            params.append(1 if request.compression_enabled else 0)
        if request.interaction_ops is not None:
            updates.append("interaction_ops = ?")
            params.append(json.dumps(request.interaction_ops, ensure_ascii=False))

        if not updates:
            return BaseResponse(message="No fields to update")

        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(character_id)

        sql = f"UPDATE characters SET {', '.join(updates)} WHERE id = ?"
        await db.execute(sql, tuple(params))

        row = await db.fetchone("SELECT * FROM characters WHERE id = ?", (character_id,))
        return BaseResponse(data={
            "id": row['id'],
            "name": row['name'],
            "save_id": row['save_id'],
            "ai_soul": row['ai_soul'],
            "ai_voice": row['ai_voice'],
            "avatar_url": row['avatar_url'],
            "compression_enabled": bool(row['compression_enabled']),
            "interaction_ops": parse_interaction_ops(row['interaction_ops']),
            "updated_at": row['updated_at'],
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating character: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{character_id}", response_model=BaseResponse)
async def delete_character(character_id: str):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT id FROM characters WHERE id = ?", (character_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Character not found")

        await db.execute("DELETE FROM characters WHERE id = ?", (character_id,))
        return BaseResponse(message="Character deleted")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting character: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{character_id}/import", response_model=BaseResponse)
async def import_character(character_id: str, request: ImportCharacterRequest):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT id FROM characters WHERE id = ?", (character_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Character not found")

        payload = request.payload

        name = payload.get('Name') or payload.get('name')
        save_id = payload.get('StringId') or payload.get('saveId') or payload.get('save_id')
        ai_soul = payload.get('AIGeneratedPersonality') or payload.get('CharacterDescription') or payload.get('aiSoul') or payload.get('ai_soul')
        ai_voice = payload.get('AssignedTTSVoice') or payload.get('aiVoice') or payload.get('ai_voice')
        avatar_url = payload.get('AvatarUrl') or payload.get('avatarUrl') or payload.get('avatar_url')

        updates = []
        params = []

        if name:
            updates.append("name = ?")
            params.append(name)
        if save_id:
            updates.append("save_id = ?")
            params.append(save_id)
        if ai_soul:
            updates.append("ai_soul = ?")
            params.append(ai_soul)
        if ai_voice:
            updates.append("ai_voice = ?")
            params.append(ai_voice)
        if avatar_url:
            updates.append("avatar_url = ?")
            params.append(avatar_url)

        updates.append("extra_data = ?")
        params.append(json.dumps(payload, ensure_ascii=False))

        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(character_id)

        sql = f"UPDATE characters SET {', '.join(updates)} WHERE id = ?"
        await db.execute(sql, tuple(params))

        conversation_history = payload.get('ConversationHistory')
        if conversation_history and isinstance(conversation_history, list):
            for msg in conversation_history:
                if isinstance(msg, str) and ':' in msg:
                    parts = msg.split(':', 1)
                    speaker = parts[0].strip()
                    content = parts[1].strip()
                    kind = 'player' if speaker.lower() in ['player', '玩家'] else 'character'

                    await db.execute(
                        """INSERT INTO conversation_messages
                        (character_id, kind, speaker, content, created_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)""",
                        (character_id, kind, speaker, content)
                    )

            await db.execute(
                """UPDATE character_memories SET
                message_count = (SELECT COUNT(*) FROM conversation_messages WHERE character_id = ?),
                updated_at = CURRENT_TIMESTAMP WHERE character_id = ?""",
                (character_id, character_id)
            )

        row = await db.fetchone("SELECT * FROM characters WHERE id = ?", (character_id,))
        return BaseResponse(data={
            "id": row['id'],
            "name": row['name'],
            "save_id": row['save_id'],
            "ai_soul": row['ai_soul'],
            "ai_voice": row['ai_voice'],
            "avatar_url": row['avatar_url'],
            "extra_data": parse_extra_data(row['extra_data']),
            "updated_at": row['updated_at'],
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing character: {e}")
        raise HTTPException(status_code=500, detail=str(e))
