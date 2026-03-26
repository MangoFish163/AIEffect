import asyncio
from typing import Optional, List, Callable, Dict, Any
from datetime import datetime
from shared_core import get_config_manager, get_logger

logger = get_logger(__name__)


class SubtitleHistoryEntry:
    def __init__(self, text: str, character_name: Optional[str] = None):
        self.text = text
        self.character_name = character_name
        self.timestamp = datetime.now()


class SubtitleService:
    def __init__(self):
        self.config_manager = get_config_manager()
        self.visible = False
        self.current_text: Optional[str] = None
        self.history: List[SubtitleHistoryEntry] = []
        self._listeners: List[Callable] = []

    def show_text(
        self,
        text: str,
        character_name: Optional[str] = None,
        typing_effect: bool = True,
    ) -> bool:
        try:
            self.visible = True
            self.current_text = text
            self.history.append(SubtitleHistoryEntry(text, character_name))
            if len(self.history) > 100:
                self.history.pop(0)
            self._notify_listeners("subtitle:update", {
                "text": text,
                "character_name": character_name,
                "typing_effect": typing_effect,
            })
            logger.info(f"Subtitle shown: {text[:50]}...")
            return True
        except Exception as e:
            logger.error(f"Failed to show subtitle: {e}")
            return False

    def hide(self) -> bool:
        try:
            self.visible = False
            self._notify_listeners("subtitle:update", {"visible": False})
            logger.info("Subtitle hidden")
            return True
        except Exception as e:
            logger.error(f"Failed to hide subtitle: {e}")
            return False

    def clear(self) -> bool:
        try:
            self.current_text = None
            self.history.clear()
            self._notify_listeners("subtitle:update", {"text": None})
            logger.info("Subtitle cleared")
            return True
        except Exception as e:
            logger.error(f"Failed to clear subtitle: {e}")
            return False

    def get_window_status(self) -> Dict[str, Any]:
        return {
            "visible": self.visible,
            "current_text": self.current_text,
        }

    def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [
            {
                "text": entry.text,
                "character_name": entry.character_name,
                "timestamp": entry.timestamp.isoformat(),
            }
            for entry in self.history[-limit:]
        ]

    def add_listener(self, listener: Callable):
        self._listeners.append(listener)

    def remove_listener(self, listener: Callable):
        if listener in self._listeners:
            self._listeners.remove(listener)

    def _notify_listeners(self, event: str, data: Dict[str, Any]):
        for listener in self._listeners:
            try:
                listener(event, data)
            except Exception as e:
                logger.error(f"Error notifying subtitle listener: {e}")


_subtitle_service_instance: Optional[SubtitleService] = None


def get_subtitle_service() -> SubtitleService:
    global _subtitle_service_instance
    if _subtitle_service_instance is None:
        _subtitle_service_instance = SubtitleService()
    return _subtitle_service_instance
