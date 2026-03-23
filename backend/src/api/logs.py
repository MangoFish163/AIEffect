from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import asyncio
from ..models.schemas import (
    LogListResponse,
    LogEntryResponse,
)
from ..services.log_service import get_log_service
from ..core.logger import get_logger

router = APIRouter(prefix="/api/logs", tags=["logs"])
logger = get_logger(__name__)


@router.get("", response_model=LogListResponse)
async def get_logs(
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
):
    try:
        log_service = get_log_service()
        logs = log_service.get_logs(
            level=level,
            module=module,
            search=search,
            limit=limit,
        )
        stats = log_service.get_stats()
        return LogListResponse(
            logs=[LogEntryResponse(**log.to_dict()) for log in logs],
            stats=stats,
        )
    except Exception as e:
        logger.error(f"Error getting logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear")
async def clear_logs():
    try:
        log_service = get_log_service()
        success = log_service.clear_logs()
        if not success:
            raise HTTPException(status_code=500, detail="Failed to clear logs")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stream")
async def stream_logs():
    async def log_generator():
        queue = asyncio.Queue()
        
        def log_listener(log_entry):
            try:
                queue.put_nowait(log_entry)
            except:
                pass
        
        log_service = get_log_service()
        log_service.add_listener(log_listener)
        
        try:
            while True:
                try:
                    log_entry = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {log_entry.to_dict()}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            log_service.remove_listener(log_listener)
    
    return StreamingResponse(
        log_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
