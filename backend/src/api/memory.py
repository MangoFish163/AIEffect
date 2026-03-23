from fastapi import APIRouter, HTTPException
from ..models.schemas import (
    CharacterListResponse,
    MemoryCompressRequest,
    MemoryCompressResponse,
)
from ..services.memory_service import get_memory_service
from ..core.logger import get_logger

router = APIRouter(prefix="/api/memory", tags=["memory"])
logger = get_logger(__name__)


@router.get("/characters", response_model=CharacterListResponse)
async def get_characters():
    try:
        memory_service = get_memory_service()
        characters = memory_service.get_characters()
        return CharacterListResponse(characters=characters)
    except Exception as e:
        logger.error(f"Error getting characters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compress", response_model=MemoryCompressResponse)
async def compress_memory(request: MemoryCompressRequest):
    try:
        memory_service = get_memory_service()
        result = await memory_service.compress_memory(
            character_name=request.character_name,
            keep_recent=request.keep_recent,
        )
        return MemoryCompressResponse(**result)
    except Exception as e:
        logger.error(f"Error compressing memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))
