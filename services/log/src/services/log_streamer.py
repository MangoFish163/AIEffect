"""
日志流服务 - SSE 实时推送
"""
import asyncio
import json
import uuid
from typing import Dict, List, Optional, Callable
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class Subscriber:
    """订阅者"""
    session_id: str
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    filter_level: Optional[str] = None
    filter_module: Optional[str] = None
    connected_at: datetime = field(default_factory=datetime.utcnow)
    last_ping: datetime = field(default_factory=datetime.utcnow)
    
    def matches(self, log: dict) -> bool:
        """检查日志是否匹配订阅条件"""
        if self.filter_level and log.get('level') != self.filter_level:
            return False
        if self.filter_module and self.filter_module not in log.get('module', ''):
            return False
        return True


class LogStreamer:
    """日志流管理器"""
    
    def __init__(self):
        self._subscribers: Dict[str, Subscriber] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task: Optional[asyncio.Task] = None
        
    async def start(self):
        """启动流服务"""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        
    async def stop(self):
        """停止流服务"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
                
    async def subscribe(self, filter_level: Optional[str] = None, filter_module: Optional[str] = None) -> Subscriber:
        """订阅日志流"""
        session_id = str(uuid.uuid4())
        subscriber = Subscriber(
            session_id=session_id,
            filter_level=filter_level,
            filter_module=filter_module
        )
        
        async with self._lock:
            self._subscribers[session_id] = subscriber
            
        return subscriber
        
    async def unsubscribe(self, session_id: str):
        """取消订阅"""
        async with self._lock:
            if session_id in self._subscribers:
                del self._subscribers[session_id]
                
    async def broadcast(self, log: dict):
        """广播日志到所有订阅者"""
        dead_subscribers = []
        
        async with self._lock:
            for session_id, subscriber in self._subscribers.items():
                if subscriber.matches(log):
                    try:
                        subscriber.queue.put_nowait(log)
                    except asyncio.QueueFull:
                        dead_subscribers.append(session_id)
                        
        # 清理死亡的订阅者
        for session_id in dead_subscribers:
            await self.unsubscribe(session_id)
            
    async def get_active_modules(self) -> List[str]:
        """获取活跃模块列表"""
        # 这里可以从数据库查询最近有日志的模块
        # 简化实现，返回常见模块
        return [
            "app.api.proxy",
            "app.api.tts",
            "app.api.subtitle",
            "app.api.memory",
            "app.api.agents",
            "app.services.proxy",
            "app.services.tts",
            "app.core.database"
        ]
        
    async def _cleanup_loop(self):
        """清理超时订阅者的循环"""
        while True:
            try:
                await asyncio.sleep(60)  # 每分钟检查一次
                
                now = datetime.utcnow()
                dead_subscribers = []
                
                async with self._lock:
                    for session_id, subscriber in self._subscribers.items():
                        # 如果超过5分钟没有心跳，认为已断开
                        if (now - subscriber.last_ping).total_seconds() > 300:
                            dead_subscribers.append(session_id)
                            
                for session_id in dead_subscribers:
                    await self.unsubscribe(session_id)
                    
            except asyncio.CancelledError:
                break
            except Exception:
                pass


# 全局流管理器实例
_streamer: Optional[LogStreamer] = None


async def get_streamer() -> LogStreamer:
    """获取流管理器实例"""
    global _streamer
    if _streamer is None:
        _streamer = LogStreamer()
        await _streamer.start()
    return _streamer
