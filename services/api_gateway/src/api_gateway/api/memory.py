from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import json
import uuid
from datetime import datetime
from pathlib import Path
from ..models.schemas import (
    BaseResponse,
    MemoryStatus,
    ConversationMessage,
    MemoryCompressResponse,
)
from shared_core import get_db, get_logger, get_config_with_fallback, DEFAULT_CONFIG

router = APIRouter(prefix="/api/memory", tags=["memory"])
logger = get_logger(__name__)


@router.get("/config", response_model=BaseResponse)
async def get_memory_config():
    """获取记忆配置，带兜底默认值"""
    try:
        config = await get_config_with_fallback('memory')
        # 确保所有默认配置项都存在
        if isinstance(config, dict):
            for key, default_value in DEFAULT_CONFIG['memory'].items():
                if key not in config:
                    config[key] = default_value
        else:
            config = DEFAULT_CONFIG['memory'].copy()
        return BaseResponse(data=config)
    except Exception as e:
        logger.error(f"Error getting memory config: {e}")
        # 返回兜底默认值
        return BaseResponse(data=DEFAULT_CONFIG['memory'].copy())


@router.put("/config", response_model=BaseResponse)
async def update_memory_config(config: dict):
    try:
        db = get_db()
        for key, value in config.items():
            full_key = f"memory.{key}"
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
        return BaseResponse(message="Memory config updated")
    except Exception as e:
        logger.error(f"Error updating memory config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/prompt-template", response_model=BaseResponse)
async def get_prompt_template():
    try:
        db = get_db()
        row = await db.fetchone(
            "SELECT value FROM config WHERE key = 'memory.compress_prompt'"
        )
        template = row['value'] if row else "请用简洁的语言总结{character_name}和{player_name}之间的对话历史。当前共有{message_count}条消息。"
        try:
            template = json.loads(template)
        except:
            pass
        return BaseResponse(data={
            "template": template,
            "placeholders": ["character_name", "player_name", "message_count"]
        })
    except Exception as e:
        logger.error(f"Error getting prompt template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/prompt-template", response_model=BaseResponse)
async def update_prompt_template(template: dict):
    try:
        db = get_db()
        template_str = template.get("template", "")
        await db.execute(
            "UPDATE config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
            (json.dumps(template_str, ensure_ascii=False), 'memory.compress_prompt')
        )
        return BaseResponse(message="Prompt template updated")
    except Exception as e:
        logger.error(f"Error updating prompt template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/prompt-template/reset", response_model=BaseResponse)
async def reset_prompt_template():
    try:
        db = get_db()
        default = "请用简洁的语言总结{character_name}和{player_name}之间的对话历史。当前共有{message_count}条消息。"
        await db.execute(
            "UPDATE config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
            (json.dumps(default, ensure_ascii=False), 'memory.compress_prompt')
        )
        return BaseResponse(data={"template": default})
    except Exception as e:
        logger.error(f"Error resetting prompt template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/characters", response_model=BaseResponse)
async def get_memory_characters():
    try:
        db = get_db()
        rows = await db.fetchall(
            """SELECT cm.*, c.name as character_name FROM character_memories cm
            JOIN characters c ON cm.character_id = c.id
            ORDER BY cm.updated_at DESC"""
        )
        characters = []
        threshold_row = await db.fetchone(
            "SELECT value FROM config WHERE key = 'memory.trigger_threshold'"
        )
        threshold = int(threshold_row['value']) if threshold_row else 300
        for row in rows:
            characters.append({
                "character_id": row['character_id'],
                "character_name": row['character_name'],
                "message_count": row['message_count'],
                "compressed_summary": row['compressed_summary'],
                "last_updated": row['updated_at'],
                "needs_compression": row['message_count'] >= threshold,
            })
        return BaseResponse(data=characters)
    except Exception as e:
        logger.error(f"Error getting memory characters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/characters/{character_id}/messages", response_model=BaseResponse)
async def get_character_messages(
    character_id: str,
    limit: int = Query(50, ge=1, le=200),
    before_id: Optional[int] = Query(None),
):
    try:
        db = get_db()
        if before_id:
            rows = await db.fetchall(
                """SELECT * FROM conversation_messages
                WHERE character_id = ? AND id < ? AND is_compressed = 0
                ORDER BY id DESC LIMIT ?""",
                (character_id, before_id, limit)
            )
        else:
            rows = await db.fetchall(
                """SELECT * FROM conversation_messages
                WHERE character_id = ? AND is_compressed = 0
                ORDER BY id DESC LIMIT ?""",
                (character_id, limit)
            )
        messages = []
        for row in rows:
            messages.append({
                "id": row['id'],
                "kind": row['kind'],
                "speaker": row['speaker'],
                "content": row['content'],
                "tokens": row['tokens'],
                "is_compressed": bool(row['is_compressed']),
                "created_at": row['created_at'],
            })
        return BaseResponse(data=list(reversed(messages)))
    except Exception as e:
        logger.error(f"Error getting character messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/characters/{character_id}/compress", response_model=BaseResponse)
async def compress_character_memory(character_id: str, keep_recent: Optional[int] = 50):
    try:
        db = get_db()
        start_time = datetime.now()

        char_row = await db.fetchone("SELECT name FROM characters WHERE id = ?", (character_id,))
        if not char_row:
            raise HTTPException(status_code=404, detail="Character not found")
        character_name = char_row['name']

        rows = await db.fetchall(
            "SELECT * FROM conversation_messages WHERE character_id = ? AND is_compressed = 0 ORDER BY id",
            (character_id,)
        )
        if len(rows) <= keep_recent:
            return BaseResponse(data={
                "compressed_count": 0,
                "retained_count": len(rows),
                "summary": None,
            })
        to_compress = rows[:-keep_recent] if keep_recent > 0 else rows
        to_retain = rows[-keep_recent:] if keep_recent > 0 else []
        summary = f"压缩了{len(to_compress)}条消息，保留了最近的{len(to_retain)}条消息。"
        batch_id = int(datetime.now().timestamp())
        for row in to_compress:
            await db.execute(
                "UPDATE conversation_messages SET is_compressed = 1, compressed_batch_id = ? WHERE id = ?",
                (batch_id, row['id'])
            )
        await db.execute(
            """INSERT INTO memory_compression_history
            (character_id, original_count, retained_count, compressed_count, summary, duration_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
            (character_id, len(rows), len(to_retain), len(to_compress), summary,
             int((datetime.now() - start_time).total_seconds() * 1000))
        )
        await db.execute(
            """UPDATE character_memories SET
            message_count = ?, compressed_summary = ?, compression_count = compression_count + 1,
            last_compressed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE character_id = ?""",
            (len(to_retain), summary, character_id)
        )
        logger.info(f"Memory compressed for {character_name}: {len(to_compress)} messages")
        return BaseResponse(data={
            "compressed_count": len(to_compress),
            "retained_count": len(to_retain),
            "summary": summary,
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error compressing memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compress-all", response_model=BaseResponse)
async def compress_all_memories():
    try:
        db = get_db()
        rows = await db.fetchall("SELECT character_id FROM character_memories")
        results = []
        for row in rows:
            char_id = row['character_id']
            result = await compress_character_memory(char_id)
            results.append({"character_id": char_id, "result": result})
        return BaseResponse(data={"results": results})
    except Exception as e:
        logger.error(f"Error compressing all memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/characters/{character_id}/messages", response_model=BaseResponse)
async def add_message(character_id: str, message: dict):
    try:
        db = get_db()

        char_row = await db.fetchone("SELECT name FROM characters WHERE id = ?", (character_id,))
        if not char_row:
            raise HTTPException(status_code=404, detail="Character not found")

        await db.execute(
            """INSERT INTO conversation_messages
            (character_id, kind, speaker, content, tokens, session_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
            (character_id, message.get('kind', 'character'), message.get('speaker'),
             message.get('content'), message.get('tokens'), message.get('session_id'))
        )
        existing = await db.fetchone(
            "SELECT * FROM character_memories WHERE character_id = ?", (character_id,)
        )
        if existing:
            await db.execute(
                """UPDATE character_memories SET
                message_count = message_count + 1, updated_at = CURRENT_TIMESTAMP
                WHERE character_id = ?""",
                (character_id,)
            )
        else:
            await db.execute(
                """INSERT INTO character_memories
                (character_id, message_count, created_at, updated_at)
                VALUES (?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
                (character_id,)
            )

        await db.execute(
            """UPDATE characters SET
            chat_count = chat_count + 1,
            token_usage = token_usage + ?,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ?""",
            (message.get('tokens', 0), character_id)
        )

        return BaseResponse(message="Message added")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
