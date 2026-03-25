from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import platform
import sys
import time
import asyncio
import json
from datetime import datetime
from ..models.schemas import BaseResponse, SystemInfo, HealthCheckResponse
from ..core.database import get_db
from ..core.logger import get_logger
from ..services.proxy_service import get_proxy_service
from ..services.tts_service import get_tts_service

router = APIRouter(prefix="/api/system", tags=["system"])
logger = get_logger(__name__)

_start_time = time.time()


async def get_health_status():
    """获取健康状态"""
    services_status = {}
    overall_status = "healthy"

    try:
        db = get_db()
        await db.fetchone("SELECT 1")
        services_status["api"] = "ok"
        services_status["database"] = "ok"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        services_status["api"] = "error"
        services_status["database"] = "error"
        overall_status = "unhealthy"

    try:
        proxy_service = get_proxy_service()
        proxy_status = proxy_service.get_status()
        services_status["proxy"] = "ok" if proxy_status.get("running") else "stopped"
    except Exception as e:
        logger.error(f"Proxy health check failed: {e}")
        services_status["proxy"] = "error"

    try:
        tts_service = get_tts_service()
        services_status["tts"] = "ok"
    except Exception as e:
        logger.error(f"TTS health check failed: {e}")
        services_status["tts"] = "error"

    try:
        db = get_db()
        await db.fetchone("SELECT 1 FROM character_memories LIMIT 1")
        services_status["memory"] = "ok"
    except Exception as e:
        logger.error(f"Memory health check failed: {e}")
        services_status["memory"] = "error"

    return {
        "status": overall_status,
        "services": services_status,
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/info", response_model=BaseResponse)
async def get_system_info():
    try:
        return BaseResponse(data={
            "version": "1.0.0",
            "platform": platform.system().lower(),
            "electron_version": None,
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "uptime_seconds": int(time.time() - _start_time),
        })
    except Exception as e:
        logger.error(f"Error getting system info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=BaseResponse)
async def health_check():
    status = await get_health_status()
    if status["status"] == "healthy":
        return BaseResponse(data=status)
    else:
        return BaseResponse(
            code=503,
            message="Service unhealthy",
            data=status
        )


@router.get("/health/stream")
async def health_stream():
    """SSE 服务状态实时推送"""
    async def status_generator():
        while True:
            try:
                status = await get_health_status()
                data = {
                    "status": status["status"],
                    "port": 8501,
                    "timestamp": status["timestamp"],
                }
                yield f"data: {json.dumps(data)}\n\n"
                # 每 5 秒推送一次状态
                await asyncio.sleep(5)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health stream: {e}")
                await asyncio.sleep(5)

    return StreamingResponse(
        status_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
