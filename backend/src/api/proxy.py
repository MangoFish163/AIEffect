from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from ..models.schemas import (
    ProxyStartRequest,
    ProxyStatusResponse,
)
from ..services.proxy_service import get_proxy_service
from ..core.logger import get_logger
import json

router = APIRouter(prefix="", tags=["proxy"])
logger = get_logger(__name__)


@router.post("/api/proxy/start", response_model=ProxyStatusResponse)
async def start_proxy(request: ProxyStartRequest = None):
    try:
        proxy_service = get_proxy_service()
        port = request.port if request else None
        success = await proxy_service.start_proxy(port)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to start proxy service")
        status = proxy_service.get_status()
        return ProxyStatusResponse(**status)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting proxy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/proxy/stop", response_model=ProxyStatusResponse)
async def stop_proxy():
    try:
        proxy_service = get_proxy_service()
        success = await proxy_service.stop_proxy()
        if not success:
            raise HTTPException(status_code=500, detail="Failed to stop proxy service")
        status = proxy_service.get_status()
        return ProxyStatusResponse(**status)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping proxy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/proxy/status", response_model=ProxyStatusResponse)
async def get_proxy_status():
    try:
        proxy_service = get_proxy_service()
        status = proxy_service.get_status()
        return ProxyStatusResponse(**status)
    except Exception as e:
        logger.error(f"Error getting proxy status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/chat/completions")
async def chat_completions(request: Request):
    try:
        proxy_service = get_proxy_service()
        if not proxy_service.running:
            raise HTTPException(status_code=503, detail="Proxy service is not running")
        
        request_data = await request.json()
        result = await proxy_service.forward_chat_completions(request_data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat completions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/models")
async def get_models():
    try:
        proxy_service = get_proxy_service()
        if not proxy_service.running:
            raise HTTPException(status_code=503, detail="Proxy service is not running")
        
        result = await proxy_service.get_models()
        
        ollama_models = result.get("models", [])
        openai_format_models = {
            "object": "list",
            "data": [
                {
                    "id": model.get("name", ""),
                    "object": "model",
                    "created": 0,
                    "owned_by": "ollama"
                }
                for model in ollama_models
            ]
        }
        return openai_format_models
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting models: {e}")
        raise HTTPException(status_code=500, detail=str(e))
