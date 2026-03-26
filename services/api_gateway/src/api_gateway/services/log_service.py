from typing import Optional, List, Dict, Any
from shared_core import get_in_memory_handler, LogEntry, get_logger

logger = get_logger(__name__)


class LogService:
    def __init__(self):
        self._handler = get_in_memory_handler()

    def get_logs(
        self,
        level: Optional[str] = None,
        module: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
    ) -> List[LogEntry]:
        if not self._handler:
            return []
        return self._handler.get_logs(
            level=level,
            module=module,
            search=search,
            limit=limit,
        )

    def get_stats(self) -> Dict[str, int]:
        if not self._handler:
            return {
                "total": 0,
                "ERROR": 0,
                "WARN": 0,
                "INFO": 0,
                "DEBUG": 0,
            }
        return self._handler.get_stats()

    def clear_logs(self) -> bool:
        if not self._handler:
            return False
        self._handler.clear()
        logger.info("Logs cleared")
        return True

    def add_listener(self, listener):
        if self._handler:
            self._handler.add_listener(listener)

    def remove_listener(self, listener):
        if self._handler:
            self._handler.remove_listener(listener)


_log_service_instance: Optional[LogService] = None


def get_log_service() -> LogService:
    global _log_service_instance
    if _log_service_instance is None:
        _log_service_instance = LogService()
    return _log_service_instance
