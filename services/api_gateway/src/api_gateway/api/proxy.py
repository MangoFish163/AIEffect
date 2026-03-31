from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx
import time
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime
from ..models.schemas import (
    BaseResponse,
    ProxyStartRequest,
    ProxyStatusResponse,
    ProxyTestResponse,
)
from shared_core import get_db, get_logger, get_config_manager

router = APIRouter(prefix="", tags=["proxy"])
logger = get_logger(__name__)

_proxy_state = {
    "is_running": False,
    "port": 8501,
    "bind_address": "127.0.0.1",
    "started_at": None,
    "request_count": 0,
}


@router.get("/api/proxy/status", response_model=BaseResponse)
async def get_proxy_status():
    try:
        access_url = None
        if _proxy_state["is_running"]:
            access_url = f"http://{_proxy_state['bind_address']}:{_proxy_state['port']}"
        return BaseResponse(data={
            "is_running": _proxy_state["is_running"],
            "port": _proxy_state["port"],
            "bind_address": _proxy_state["bind_address"],
            "access_url": access_url,
            "started_at": _proxy_state["started_at"],
            "request_count": _proxy_state["request_count"],
        })
    except Exception as e:
        logger.error(f"Error getting proxy status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/proxy/start", response_model=BaseResponse)
async def start_proxy(request: ProxyStartRequest):
    try:
        global _proxy_state
        _proxy_state["is_running"] = True
        _proxy_state["port"] = request.port or 8501
        _proxy_state["bind_address"] = request.bind_address or "127.0.0.1"
        _proxy_state["started_at"] = datetime.now()
        _proxy_state["request_count"] = 0
        logger.info(f"Proxy started on {_proxy_state['bind_address']}:{_proxy_state['port']}")
        return BaseResponse(data={
            "is_running": True,
            "port": _proxy_state["port"],
            "bind_address": _proxy_state["bind_address"],
            "access_url": f"http://{_proxy_state['bind_address']}:{_proxy_state['port']}",
            "started_at": _proxy_state["started_at"],
            "request_count": 0,
        })
    except Exception as e:
        logger.error(f"Error starting proxy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/proxy/stop", response_model=BaseResponse)
async def stop_proxy():
    try:
        global _proxy_state
        _proxy_state["is_running"] = False
        _proxy_state["started_at"] = None
        logger.info("Proxy stopped")
        return BaseResponse(data={
            "is_running": False,
            "port": _proxy_state["port"],
            "bind_address": _proxy_state["bind_address"],
            "access_url": None,
            "started_at": None,
            "request_count": _proxy_state["request_count"],
        })
    except Exception as e:
        logger.error(f"Error stopping proxy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/proxy/test", response_model=BaseResponse)
async def test_proxy(request: Request):
    try:
        config_manager = get_config_manager()
        user_request_format = config_manager.config.api.request_format
        test_data = await request.json()
        
        start_time = time.time()
        
        # 尝试使用用户指定的格式
        try:
            result = await _test_with_format(user_request_format, test_data)
            latency_ms = int((time.time() - start_time) * 1000)
            return BaseResponse(data={
                "success": True,
                "format_used": user_request_format,
                "latency_ms": latency_ms,
                "model_list": ["deepseek-chat", "gpt-4", "claude-3-opus"],
                "result": result,
            })
        except Exception as e:
            logger.warning(f"User-specified format '{user_request_format}' failed, falling back to OpenAI format: {e}")
            
            # 降级到 OpenAI 格式
            result = await _test_with_format("openai", test_data)
            latency_ms = int((time.time() - start_time) * 1000)
            return BaseResponse(data={
                "success": True,
                "format_used": "openai",
                "fallback_from": user_request_format,
                "latency_ms": latency_ms,
                "model_list": ["deepseek-chat", "gpt-4", "claude-3-opus"],
                "result": result,
            })
    except Exception as e:
        logger.error(f"Error testing proxy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _test_with_format(request_format: str, test_data: Dict[str, Any]) -> Dict[str, Any]:
    """使用指定格式测试请求"""
    if request_format == "openai":
        # OpenAI 格式
        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": test_data.get("model", "gpt-4"),
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "This is a test response from AIEffect proxy service.",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 10,
                "total_tokens": 20,
            }
        }
    elif request_format == "ollama":
        # Ollama 格式
        return {
            "model": test_data.get("model", "llama2"),
            "created_at": datetime.now().isoformat(),
            "message": {
                "role": "assistant",
                "content": "This is a test response from AIEffect proxy service.",
            },
            "done": True,
            "total_duration": 1000000000,
            "load_duration": 1000000000,
            "prompt_eval_count": 10,
            "eval_count": 10,
        }
    else:
        # 不支持的格式
        raise ValueError(f"Unsupported request format: {request_format}")


@router.post("/v1/chat/completions")
async def chat_completions(request: Request):
    try:
        if not _proxy_state["is_running"]:
            raise HTTPException(status_code=503, detail="Proxy service is not running")
        _proxy_state["request_count"] += 1
        request_data = await request.json()
        logger.info(f"Chat completion request: {request_data.get('model', 'unknown')}")
        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": request_data.get("model", "unknown"),
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "This is a mock response from AIEffect proxy service.",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 10,
                "total_tokens": 20,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat completions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/models")
async def get_models():
    try:
        if not _proxy_state["is_running"]:
            raise HTTPException(status_code=503, detail="Proxy service is not running")
        return {
            "object": "list",
            "data": [
                {
                    "id": "deepseek-chat",
                    "object": "model",
                    "created": 0,
                    "owned_by": "deepseek"
                },
                {
                    "id": "gpt-4",
                    "object": "model",
                    "created": 0,
                    "owned_by": "openai"
                },
                {
                    "id": "claude-3-opus",
                    "object": "model",
                    "created": 0,
                    "owned_by": "anthropic"
                },
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


import asyncio
