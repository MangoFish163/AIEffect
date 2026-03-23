import asyncio
from typing import Optional, Dict, Any
from pathlib import Path
from ..core.config import get_config_manager
from ..core.logger import get_logger

logger = get_logger(__name__)


class TTSEngine:
    async def synthesize(self, text: str, **kwargs) -> Dict[str, Any]:
        raise NotImplementedError


class GPTSoVITSEngine(TTSEngine):
    def __init__(self):
        self.config_manager = get_config_manager()

    async def synthesize(self, text: str, **kwargs) -> Dict[str, Any]:
        logger.info(f"GPT-SoVITS synthesizing: {text[:50]}...")
        await asyncio.sleep(0.5)
        return {
            "audio_url": None,
            "duration": len(text) * 0.1,
            "success": True,
            "message": "TTS synthesis completed",
        }


class XunfeiEngine(TTSEngine):
    def __init__(self):
        self.config_manager = get_config_manager()

    async def synthesize(self, text: str, **kwargs) -> Dict[str, Any]:
        logger.info(f"Xunfei TTS synthesizing: {text[:50]}...")
        await asyncio.sleep(0.5)
        return {
            "audio_url": None,
            "duration": len(text) * 0.1,
            "success": True,
            "message": "TTS synthesis completed",
        }


class TTSService:
    def __init__(self):
        self.config_manager = get_config_manager()
        self.engines: Dict[str, TTSEngine] = {
            "gpt_sovits": GPTSoVITSEngine(),
            "xunfei": XunfeiEngine(),
        }

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        engine: Optional[str] = None,
        speed: float = 1.0,
        volume: Optional[float] = None,
    ) -> Dict[str, Any]:
        config = self.config_manager.config.tts
        if not config.enabled:
            return {
                "audio_url": None,
                "duration": None,
                "success": False,
                "message": "TTS is disabled",
            }

        engine_name = engine or config.engine
        if engine_name not in self.engines:
            return {
                "audio_url": None,
                "duration": None,
                "success": False,
                "message": f"Unknown TTS engine: {engine_name}",
            }

        try:
            tts_engine = self.engines[engine_name]
            result = await tts_engine.synthesize(
                text,
                voice_id=voice_id,
                speed=speed,
                volume=volume or config.volume,
            )
            return result
        except Exception as e:
            logger.error(f"TTS synthesis failed: {e}")
            return {
                "audio_url": None,
                "duration": None,
                "success": False,
                "message": str(e),
            }


_tts_service_instance: Optional[TTSService] = None


def get_tts_service() -> TTSService:
    global _tts_service_instance
    if _tts_service_instance is None:
        _tts_service_instance = TTSService()
    return _tts_service_instance
