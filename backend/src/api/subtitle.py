from fastapi import APIRouter, HTTPException
from ..models.schemas import (
    SubtitleShowRequest,
    SubtitleWindowResponse,
)
from ..services.subtitle_service import get_subtitle_service
from ..core.logger import get_logger

router = APIRouter(prefix="/api/subtitle", tags=["subtitle"])
logger = get_logger(__name__)


@router.get("/window", response_model=SubtitleWindowResponse)
async def get_subtitle_window():
    try:
        subtitle_service = get_subtitle_service()
        status = subtitle_service.get_window_status()
        return SubtitleWindowResponse(**status)
    except Exception as e:
        logger.error(f"Error getting subtitle window: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/show", response_model=SubtitleWindowResponse)
async def show_subtitle(request: SubtitleShowRequest):
    try:
        subtitle_service = get_subtitle_service()
        success = subtitle_service.show_text(
            text=request.text,
            character_name=request.character_name,
            typing_effect=request.typing_effect,
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to show subtitle")
        status = subtitle_service.get_window_status()
        return SubtitleWindowResponse(**status)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error showing subtitle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hide", response_model=SubtitleWindowResponse)
async def hide_subtitle():
    try:
        subtitle_service = get_subtitle_service()
        success = subtitle_service.hide()
        if not success:
            raise HTTPException(status_code=500, detail="Failed to hide subtitle")
        status = subtitle_service.get_window_status()
        return SubtitleWindowResponse(**status)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error hiding subtitle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear", response_model=SubtitleWindowResponse)
async def clear_subtitle():
    try:
        subtitle_service = get_subtitle_service()
        success = subtitle_service.clear()
        if not success:
            raise HTTPException(status_code=500, detail="Failed to clear subtitle")
        status = subtitle_service.get_window_status()
        return SubtitleWindowResponse(**status)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing subtitle: {e}")
        raise HTTPException(status_code=500, detail=str(e))
