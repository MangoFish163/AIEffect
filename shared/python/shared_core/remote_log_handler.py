"""远程日志处理器

将日志发送到独立的日志服务，支持：
- 批量发送
- 自动重连
- 异步处理
- 本地缓冲队列（网络故障时）
- 自动重试机制
"""

import logging
import asyncio
import aiohttp
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from queue import Queue
import threading
import time


class RemoteLogHandler(logging.Handler):
    """远程日志处理器

    将日志批量发送到独立的日志服务。

    Attributes:
        service_url: 日志服务地址
        batch_size: 批量发送大小
        flush_interval: 刷新间隔（秒）
        max_retries: 最大重试次数
        retry_delay: 重试延迟（秒）
        enable_local_buffer: 是否启用本地缓冲
        buffer_dir: 本地缓冲目录
    """

    def __init__(
        self,
        service_url: str = None,
        batch_size: int = 50,
        flush_interval: float = 5.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        enable_local_buffer: bool = True,
        buffer_dir: str = None
    ):
        super().__init__()
        self.service_url = (service_url or os.getenv("LOG_SERVICE_URL", "http://localhost:8505")).rstrip('/')
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.enable_local_buffer = enable_local_buffer

        # 本地缓冲配置
        if buffer_dir:
            self.buffer_dir = Path(buffer_dir)
        else:
            self.buffer_dir = Path(os.getenv("LOG_BUFFER_DIR", "./data/log_buffer"))
        self.buffer_dir.mkdir(parents=True, exist_ok=True)

        # 内存缓冲区
        self._buffer: List[Dict[str, Any]] = []
        self._lock = threading.Lock()

        # HTTP会话
        self._session: Optional[aiohttp.ClientSession] = None
        self._session_lock = asyncio.Lock()

        # 刷新任务
        self._flush_task: Optional[asyncio.Task] = None
        self._running = False

        # 统计信息
        self._stats = {
            "sent": 0,
            "failed": 0,
            "buffered": 0,
            "retried": 0
        }

    async def _get_session(self) -> aiohttp.ClientSession:
        """获取或创建HTTP会话"""
        async with self._session_lock:
            if self._session is None or self._session.closed:
                connector = aiohttp.TCPConnector(
                    limit=10,
                    limit_per_host=5,
                    enable_cleanup_closed=True,
                    force_close=True,
                )
                timeout = aiohttp.ClientTimeout(total=30, connect=10)
                self._session = aiohttp.ClientSession(
                    connector=connector,
                    timeout=timeout,
                    headers={"Content-Type": "application/json"}
                )
            return self._session

    def emit(self, record: logging.LogRecord):
        """处理日志记录"""
        try:
            log_entry = self._format_record(record)

            with self._lock:
                self._buffer.append(log_entry)
                should_flush = len(self._buffer) >= self.batch_size

            # 达到批量大小，立即发送
            if should_flush:
                self._trigger_flush()

        except Exception:
            self.handleError(record)

    def _format_record(self, record: logging.LogRecord) -> Dict[str, Any]:
        """格式化日志记录为字典"""
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "module": record.name,
            "message": self.format(record),
            "source_file": record.pathname,
            "source_line": record.lineno,
            "function_name": record.funcName,
            "process_id": os.getpid(),
            "thread_id": threading.current_thread().ident,
        }

        # 添加异常信息
        if record.exc_info:
            exc_type = record.exc_info[0]
            log_entry["exception_type"] = exc_type.__name__ if exc_type else None
            log_entry["exception_message"] = str(record.exc_info[1]) if record.exc_info[1] else None
            import traceback
            log_entry["exception_traceback"] = ''.join(traceback.format_exception(*record.exc_info))

        # 添加额外属性
        if hasattr(record, 'trace_id'):
            log_entry["trace_id"] = record.trace_id
        if hasattr(record, 'span_id'):
            log_entry["span_id"] = record.span_id

        return log_entry

    def _trigger_flush(self):
        """触发异步刷新"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self.flush())
        except RuntimeError:
            # 没有运行的事件循环，使用线程池
            pass

    async def _send_batch(self, logs: List[Dict[str, Any]], retry_count: int = 0) -> bool:
        """发送日志批次，带重试机制"""
        if not logs:
            return True

        try:
            session = await self._get_session()
            url = f"{self.service_url}/ingest"

            payload = {
                "logs": logs,
                "source": "remote_handler",
                "batch_id": f"batch_{int(time.time() * 1000)}"
            }

            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    self._stats["sent"] += len(logs)
                    return True
                else:
                    raise aiohttp.ClientError(f"HTTP {response.status}")

        except Exception as e:
            if retry_count < self.max_retries:
                self._stats["retried"] += 1
                await asyncio.sleep(self.retry_delay * (retry_count + 1))
                return await self._send_batch(logs, retry_count + 1)
            else:
                self._stats["failed"] += len(logs)
                if self.enable_local_buffer:
                    await self._buffer_to_local(logs)
                return False

    async def _buffer_to_local(self, logs: List[Dict[str, Any]]):
        """将失败的日志缓冲到本地文件"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            buffer_file = self.buffer_dir / f"buffer_{timestamp}_{os.getpid()}.jsonl"

            with open(buffer_file, 'a', encoding='utf-8') as f:
                for log in logs:
                    f.write(json.dumps(log, ensure_ascii=False) + '\n')

            self._stats["buffered"] += len(logs)
        except Exception:
            pass

    async def _flush_loop(self):
        """定期刷新缓冲区"""
        while self._running:
            try:
                await asyncio.sleep(self.flush_interval)
                await self.flush()
            except asyncio.CancelledError:
                break
            except Exception:
                pass

    async def flush(self) -> bool:
        """立即发送缓冲区中的所有日志"""
        with self._lock:
            if not self._buffer:
                return True
            buffer_copy = self._buffer.copy()
            self._buffer.clear()

        return await self._send_batch(buffer_copy)

    async def flush_local_buffer(self) -> int:
        """尝试发送本地缓冲的日志"""
        sent_count = 0
        try:
            buffer_files = list(self.buffer_dir.glob("buffer_*.jsonl"))
            for buffer_file in buffer_files:
                try:
                    logs = []
                    with open(buffer_file, 'r', encoding='utf-8') as f:
                        for line in f:
                            if line.strip():
                                logs.append(json.loads(line))

                    if logs and await self._send_batch(logs):
                        buffer_file.unlink()
                        sent_count += len(logs)
                except Exception:
                    pass
        except Exception:
            pass
        return sent_count

    def start(self):
        """启动处理器"""
        self._running = True
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                self._flush_task = asyncio.create_task(self._flush_loop())
        except RuntimeError:
            pass

    def stop(self):
        """停止处理器"""
        self._running = False
        if self._flush_task:
            self._flush_task.cancel()

    async def stop_async(self):
        """异步停止处理器，确保所有日志发送完成"""
        self._running = False
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass

        # 刷新剩余日志
        await self.flush()

        # 关闭会话
        async with self._session_lock:
            if self._session and not self._session.closed:
                await self._session.close()
                self._session = None

    def close(self):
        """关闭处理器"""
        self.stop()
        super().close()

    def get_stats(self) -> Dict[str, int]:
        """获取统计信息"""
        return self._stats.copy()


class RemoteLogHandlerSync(logging.Handler):
    """同步版本的远程日志处理器

    用于不支持异步的场景，如同步脚本。
    """

    def __init__(
        self,
        service_url: str = None,
        batch_size: int = 50,
        flush_interval: float = 5.0
    ):
        super().__init__()
        self.service_url = (service_url or os.getenv("LOG_SERVICE_URL", "http://localhost:8505")).rstrip('/')
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self._buffer: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._flush_timer: Optional[threading.Timer] = None
        self._running = False

    def emit(self, record: logging.LogRecord):
        """处理日志记录"""
        try:
            log_entry = {
                "timestamp": datetime.fromtimestamp(record.created).isoformat(),
                "level": record.levelname,
                "module": record.name,
                "message": self.format(record),
                "source_file": record.pathname,
                "source_line": record.lineno,
            }

            with self._lock:
                self._buffer.append(log_entry)
                should_flush = len(self._buffer) >= self.batch_size

            if should_flush:
                self._flush_sync()

        except Exception:
            self.handleError(record)

    def _flush_sync(self):
        """同步刷新缓冲区"""
        with self._lock:
            if not self._buffer:
                return
            logs = self._buffer.copy()
            self._buffer.clear()

        # 在新线程中发送
        threading.Thread(target=self._send_sync, args=(logs,), daemon=True).start()

    def _send_sync(self, logs: List[Dict[str, Any]]):
        """同步发送日志"""
        try:
            import urllib.request
            import urllib.error

            url = f"{self.service_url}/ingest"
            payload = json.dumps({
                "logs": logs,
                "source": "remote_handler_sync",
                "batch_id": f"batch_{int(time.time() * 1000)}"
            }).encode('utf-8')

            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=30) as response:
                if response.status == 200:
                    return True
        except Exception:
            pass
        return False

    def start(self):
        """启动处理器"""
        self._running = True
        self._schedule_flush()

    def _schedule_flush(self):
        """调度定期刷新"""
        if self._running:
            self._flush_sync()
            self._flush_timer = threading.Timer(self.flush_interval, self._schedule_flush)
            self._flush_timer.start()

    def stop(self):
        """停止处理器"""
        self._running = False
        if self._flush_timer:
            self._flush_timer.cancel()
        self._flush_sync()

    def close(self):
        """关闭处理器"""
        self.stop()
        super().close()


def create_remote_handler(
    service_url: str = None,
    level: int = logging.INFO,
    async_mode: bool = True,
    **kwargs
) -> logging.Handler:
    """创建远程日志处理器的工厂函数

    Args:
        service_url: 日志服务地址
        level: 日志级别
        async_mode: 是否使用异步模式
        **kwargs: 其他配置参数

    Returns:
        配置好的日志处理器
    """
    if async_mode:
        handler = RemoteLogHandler(service_url=service_url, **kwargs)
    else:
        handler = RemoteLogHandlerSync(service_url=service_url, **kwargs)

    handler.setLevel(level)

    # 设置格式化器
    formatter = logging.Formatter(
        '%(message)s'
    )
    handler.setFormatter(formatter)

    return handler
