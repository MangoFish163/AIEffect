import os
import json
import httpx
from datetime import datetime
from typing import List, Optional
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from ..models.schemas import BaseResponse
from shared_core import get_config_manager, get_logger

router = APIRouter(prefix="/api/ai-assistant", tags=["ai-assistant"])
logger = get_logger(__name__)

SAVE_DIR = Path("./save_data/ai_assistant/chat")
CHAT_FILE = "ai_assistant_data.txt"
MAX_HISTORY = 10


def _ensure_save_dir():
    SAVE_DIR.mkdir(parents=True, exist_ok=True)


def _get_chat_file_path() -> Path:
    _ensure_save_dir()
    return SAVE_DIR / CHAT_FILE


def _load_chat_history() -> List[dict]:
    chat_file = _get_chat_file_path()
    if not chat_file.exists():
        return []
    try:
        with open(chat_file, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return []
            messages = []
            for line in content.split("\n"):
                line = line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                    messages.append(msg)
                except json.JSONDecodeError:
                    continue
            return messages
    except Exception as e:
        logger.error(f"Error loading chat history: {e}")
        return []


def _save_message(message: dict):
    chat_file = _get_chat_file_path()
    try:
        with open(chat_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(message, ensure_ascii=False) + "\n")
    except Exception as e:
        logger.error(f"Error saving message: {e}")


def _get_recent_history(limit: int = MAX_HISTORY) -> List[dict]:
    history = _load_chat_history()
    return history[-limit:] if len(history) > limit else history


def _check_model_configured() -> tuple[bool, str]:
    """检查 AI 模型是否已配置

    Returns:
        (是否已配置, 错误信息)
    """
    config_manager = get_config_manager()
    api_config = config_manager.config.api

    if not api_config.api_url or not api_config.api_url.strip():
        return False, "模型 API 地址未配置"

    if not api_config.model_name or not api_config.model_name.strip():
        return False, "模型名称未配置"

    return True, ""


@router.get("/status", response_model=BaseResponse)
async def get_assistant_status():
    """获取 AI 助手状态，包括模型配置状态"""
    try:
        is_configured, error_msg = _check_model_configured()
        config_manager = get_config_manager()
        api_config = config_manager.config.api

        return BaseResponse(data={
            "model_configured": is_configured,
            "error_message": error_msg if not is_configured else None,
            "model_info": {
                "api_url": api_config.api_url if is_configured else None,
                "model_name": api_config.model_name if is_configured else None,
                "provider": api_config.provider if is_configured else None,
            } if is_configured else None
        })
    except Exception as e:
        logger.error(f"Error getting assistant status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=BaseResponse)
async def get_chat_history(limit: int = MAX_HISTORY):
    try:
        history = _get_recent_history(limit)
        return BaseResponse(data={
            "messages": history,
            "total": len(_load_chat_history()),
            "returned": len(history)
        })
    except Exception as e:
        logger.error(f"Error getting chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat", response_model=BaseResponse)
async def chat(message: dict):
    try:
        user_content = message.get("content", "").strip()
        if not user_content:
            raise HTTPException(status_code=400, detail="Message content is required")

        # 先检查模型配置
        is_configured, error_msg = _check_model_configured()
        if not is_configured:
            return BaseResponse(
                code=400,
                message=f"模型未配置: {error_msg}",
                data={
                    "configured": False,
                    "error": error_msg
                }
            )

        user_msg = {
            "id": message.get("id", str(int(datetime.now().timestamp() * 1000))),
            "role": "user",
            "content": user_content,
            "timestamp": datetime.now().isoformat()
        }
        _save_message(user_msg)

        config_manager = get_config_manager()
        api_config = config_manager.config.api

        history = _get_recent_history(MAX_HISTORY - 1)
        messages_for_api = []

        system_prompt = {
            "role": "system",
            "content": "你是星野，是 AI Voice Bridge 的虚拟助手。你可以将文字变成有感情的声音，还能理解用户说的话。请用友好、亲切的语气回答用户的问题。"
        }
        messages_for_api.append(system_prompt)

        for h in history:
            messages_for_api.append({
                "role": h.get("role", "user"),
                "content": h.get("content", "")
            })
        messages_for_api.append({"role": "user", "content": user_content})

        headers = {
            "Content-Type": "application/json"
        }
        if api_config.api_key:
            headers["Authorization"] = f"Bearer {api_config.api_key}"

        request_data = {
            "model": api_config.model_name,
            "messages": messages_for_api,
            "temperature": 0.7,
            "max_tokens": 2000
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{api_config.api_url.rstrip('/')}/chat/completions",
                    headers=headers,
                    json=request_data
                )
                response.raise_for_status()
                result = response.json()

                assistant_content = result["choices"][0]["message"]["content"]
                assistant_msg = {
                    "id": str(int(datetime.now().timestamp() * 1000) + 1),
                    "role": "assistant",
                    "content": assistant_content,
                    "timestamp": datetime.now().isoformat()
                }
                _save_message(assistant_msg)
                return BaseResponse(data={"message": assistant_msg})

            except httpx.HTTPStatusError as e:
                logger.error(f"AI API HTTP error: {e.response.status_code} - {e.response.text}")
                error_msg = f"AI 服务请求失败 (HTTP {e.response.status_code})"
                assistant_msg = {
                    "id": str(int(datetime.now().timestamp() * 1000) + 1),
                    "role": "assistant",
                    "content": error_msg,
                    "timestamp": datetime.now().isoformat()
                }
                _save_message(assistant_msg)
                return BaseResponse(data={"message": assistant_msg})

            except httpx.RequestError as e:
                logger.error(f"AI API request error: {e}")
                error_msg = "无法连接到 AI 服务，请检查网络连接或 API 配置"
                assistant_msg = {
                    "id": str(int(datetime.now().timestamp() * 1000) + 1),
                    "role": "assistant",
                    "content": error_msg,
                    "timestamp": datetime.now().isoformat()
                }
                _save_message(assistant_msg)
                return BaseResponse(data={"message": assistant_msg})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def chat_stream(message: dict):
    try:
        user_content = message.get("content", "").strip()
        if not user_content:
            raise HTTPException(status_code=400, detail="Message content is required")

        user_msg = {
            "id": message.get("id", str(int(datetime.now().timestamp() * 1000))),
            "role": "user",
            "content": user_content,
            "timestamp": datetime.now().isoformat()
        }
        _save_message(user_msg)

        config_manager = get_config_manager()
        api_config = config_manager.config.api

        if not api_config.api_url or not api_config.model_name:
            async def error_generator():
                error_msg = {
                    "id": str(int(datetime.now().timestamp() * 1000) + 1),
                    "role": "assistant",
                    "content": "抱歉，AI 模型尚未配置。请在控制面板中配置 API 地址和模型名称。",
                    "timestamp": datetime.now().isoformat()
                }
                _save_message(error_msg)
                yield f"data: {json.dumps({'type': 'message', 'data': error_msg})}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(error_generator(), media_type="text/event-stream")

        history = _get_recent_history(MAX_HISTORY - 1)
        messages_for_api = []

        system_prompt = {
            "role": "system",
            "content": "你是星野，是 AI Voice Bridge 的虚拟助手。你可以将文字变成有感情的声音，还能理解用户说的话。请用友好、亲切的语气回答用户的问题。"
        }
        messages_for_api.append(system_prompt)

        for h in history:
            messages_for_api.append({
                "role": h.get("role", "user"),
                "content": h.get("content", "")
            })
        messages_for_api.append({"role": "user", "content": user_content})

        headers = {
            "Content-Type": "application/json"
        }
        if api_config.api_key:
            headers["Authorization"] = f"Bearer {api_config.api_key}"

        request_data = {
            "model": api_config.model_name,
            "messages": messages_for_api,
            "temperature": 0.7,
            "max_tokens": 2000,
            "stream": True
        }

        async def stream_generator():
            full_content = ""
            message_id = str(int(datetime.now().timestamp() * 1000) + 1)

            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    async with client.stream(
                        "POST",
                        f"{api_config.api_url.rstrip('/')}/chat/completions",
                        headers=headers,
                        json=request_data
                    ) as response:
                        response.raise_for_status()

                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                data = line[6:]
                                if data == "[DONE]":
                                    break
                                try:
                                    chunk = json.loads(data)
                                    delta = chunk["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        full_content += content
                                        yield f"data: {json.dumps({'type': 'chunk', 'content': content}, ensure_ascii=False)}\n\n"
                                except (json.JSONDecodeError, KeyError):
                                    continue

            except Exception as e:
                logger.error(f"Stream error: {e}")
                if not full_content:
                    full_content = "抱歉，与 AI 服务通信时发生错误。"

            assistant_msg = {
                "id": message_id,
                "role": "assistant",
                "content": full_content,
                "timestamp": datetime.now().isoformat()
            }
            _save_message(assistant_msg)
            yield f"data: {json.dumps({'type': 'done', 'message': assistant_msg}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(stream_generator(), media_type="text/event-stream")

    except Exception as e:
        logger.error(f"Error in chat stream: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/history", response_model=BaseResponse)
async def clear_chat_history():
    try:
        chat_file = _get_chat_file_path()
        if chat_file.exists():
            chat_file.unlink()
        return BaseResponse(message="Chat history cleared successfully")
    except Exception as e:
        logger.error(f"Error clearing chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
