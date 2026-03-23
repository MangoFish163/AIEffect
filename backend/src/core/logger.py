import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any
from .config import get_config_manager


class LogEntry:
    def __init__(self, level: str, module: str, message: str, timestamp: datetime = None):
        self.level = level
        self.module = module
        self.message = message
        self.timestamp = timestamp or datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "level": self.level,
            "module": self.module,
            "message": self.message,
        }


class InMemoryLogHandler(logging.Handler):
    def __init__(self, max_entries: int = 1000):
        super().__init__()
        self.max_entries = max_entries
        self.logs: List[LogEntry] = []
        self.listeners: List[callable] = []

    def emit(self, record: logging.LogRecord):
        log_entry = LogEntry(
            level=record.levelname,
            module=record.name,
            message=self.format(record),
            timestamp=datetime.fromtimestamp(record.created)
        )
        self.logs.append(log_entry)
        if len(self.logs) > self.max_entries:
            self.logs.pop(0)
        for listener in self.listeners:
            try:
                listener(log_entry)
            except Exception:
                pass

    def add_listener(self, listener: callable):
        self.listeners.append(listener)

    def remove_listener(self, listener: callable):
        if listener in self.listeners:
            self.listeners.remove(listener)

    def get_logs(
        self,
        level: str = None,
        module: str = None,
        search: str = None,
        limit: int = 100
    ) -> List[LogEntry]:
        filtered = self.logs
        if level:
            filtered = [log for log in filtered if log.level == level]
        if module:
            filtered = [log for log in filtered if module in log.module]
        if search:
            filtered = [log for log in filtered if search.lower() in log.message.lower()]
        return filtered[-limit:]

    def get_stats(self) -> Dict[str, int]:
        stats = {
            "total": len(self.logs),
            "ERROR": 0,
            "WARN": 0,
            "INFO": 0,
            "DEBUG": 0,
        }
        for log in self.logs:
            if log.level in stats:
                stats[log.level] += 1
        return stats

    def clear(self):
        self.logs.clear()


_in_memory_handler = None


def setup_logger():
    global _in_memory_handler
    
    config_manager = get_config_manager()
    settings = config_manager.settings
    
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    log_file = Path(settings.log_file)
    log_file.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(console_formatter)
    logger.addHandler(file_handler)
    
    _in_memory_handler = InMemoryLogHandler(max_entries=1000)
    _in_memory_handler.setFormatter(console_formatter)
    logger.addHandler(_in_memory_handler)
    
    return logger


def get_in_memory_handler() -> InMemoryLogHandler:
    return _in_memory_handler


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
