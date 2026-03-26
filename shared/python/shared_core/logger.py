"""日志系统模块

提供统一的日志管理功能，支持：
- 控制台输出
- 文件记录
- 内存缓存（用于实时查看）
- 数据库存储
- 远程日志上报
"""

import logging
import sys
import json
import traceback
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
from .config import get_config_manager


class LogEntry:
    """日志条目"""
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
    """内存日志处理器，用于实时日志查看"""
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


class DatabaseLogHandler(logging.Handler):
    """将日志写入数据库的处理器"""

    def __init__(self):
        super().__init__()
        self._db = None

    def _get_db(self):
        """延迟导入数据库，避免循环依赖"""
        if self._db is None:
            try:
                from .database import get_db
                self._db = get_db()
            except Exception as e:
                # 如果数据库不可用，静默失败
                pass
        return self._db

    def emit(self, record: logging.LogRecord):
        """将日志记录写入数据库"""
        try:
            db = self._get_db()
            if db is None:
                return

            # 提取异常信息
            exception_type = None
            exception_traceback = None
            if record.exc_info:
                exception_type = record.exc_info[0].__name__ if record.exc_info[0] else None
                exception_traceback = traceback.format_exception(*record.exc_info)
                exception_traceback = ''.join(exception_traceback)

            # 构建metadata
            metadata = {}
            if hasattr(record, 'funcName'):
                metadata['function'] = record.funcName
            if hasattr(record, 'lineno'):
                metadata['line'] = record.lineno

            # 异步写入数据库
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # 如果事件循环正在运行，创建任务
                    asyncio.create_task(self._async_insert_log(
                        db, record, exception_type, exception_traceback, metadata
                    ))
                else:
                    # 否则直接运行
                    loop.run_until_complete(self._async_insert_log(
                        db, record, exception_type, exception_traceback, metadata
                    ))
            except RuntimeError:
                # 没有事件循环时，使用同步方式
                pass
        except Exception:
            # 日志写入失败不应影响主程序
            pass

    async def _async_insert_log(self, db, record, exception_type, exception_traceback, metadata):
        """异步插入日志到数据库"""
        try:
            # 只存储纯消息内容，不包含格式化的时间、模块名等信息
            message = record.getMessage()
            # 如果有异常信息，追加到消息中
            if exception_traceback:
                message = f"{message}\n{exception_traceback}"

            await db.execute(
                """INSERT INTO system_logs
                (timestamp, level, module, message, metadata, source_file, source_line, exception_type, exception_traceback)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    datetime.fromtimestamp(record.created),
                    record.levelname,
                    record.name,
                    message,
                    json.dumps(metadata, ensure_ascii=False) if metadata else None,
                    record.pathname if hasattr(record, 'pathname') else None,
                    record.lineno if hasattr(record, 'lineno') else None,
                    exception_type,
                    exception_traceback,
                )
            )
        except Exception:
            # 忽略数据库写入错误
            pass


_in_memory_handler = None
_db_handler = None


def setup_logger():
    """设置日志系统"""
    global _in_memory_handler, _db_handler

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

    # 添加数据库日志处理器
    _db_handler = DatabaseLogHandler()
    _db_handler.setFormatter(console_formatter)
    logger.addHandler(_db_handler)

    # 添加远程日志处理器（独立日志服务）
    try:
        from .remote_log_handler import RemoteLogHandler
        _remote_handler = RemoteLogHandler(
            service_url="http://localhost:8505",
            batch_size=50,
            flush_interval=5.0
        )
        _remote_handler.setFormatter(console_formatter)
        logger.addHandler(_remote_handler)
    except Exception:
        # 远程日志服务不可用时，静默失败
        pass

    return logger


def get_in_memory_handler() -> InMemoryLogHandler:
    """获取内存日志处理器"""
    return _in_memory_handler


def get_db_handler() -> DatabaseLogHandler:
    """获取数据库日志处理器"""
    return _db_handler


def get_logger(name: str) -> logging.Logger:
    """获取命名日志器"""
    return logging.getLogger(name)
