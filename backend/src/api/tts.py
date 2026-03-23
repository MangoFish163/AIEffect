from fastapi import APIRouter, HTTPException
from ..models.schemas import (
    TTSSynthesizeRequest,
    TTSSynthesizeResponse,
)
from ..services.tts_service import get_tts_service
from ..core.logger import get_logger

router = APIRouter(prefix="/api/tts", tags=["tts"])
logger = get_logger(__name__)


@router.post("/synthesize", response_model=TTSSynthesizeResponse)
async def synthesize_speech(request: TTSSynthesizeRequest):
    try:
        tts_service = get_tts_service()
        result = await tts_service.synthesize(
            text=request.text,
            voice_id=request.voice_id,
            engine=request.engine,
            speed=request.speed,
            volume=request.volume,
        )
        return TTSSynthesizeResponse(**result)
    except Exception as e:
        logger.error(f"Error synthesizing speech: {e}")
        raise HTTPException(status_code=500, detail=str(e))
