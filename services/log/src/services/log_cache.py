"""
日志缓存服务 - 内存缓存最近N条日志

功能：
- 缓存最近200条日志
- 滚动替换策略
- 支持筛选查询
- 实时推送到前端
"""
import asyncio
from typing import Optional, List, Dict, Any
from collections import deque
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class CachedLogEntry:
    """缓存的日志条目"""
    id: str
    timestamp: str
    level: str
    module: str
    message: str
    source_file: Optional[str] = None
    source_line: Optional[int] = None
    function_name: Optional[str] = None
    exception_type: Optional[str] = None
    exception_message: Optional[str] = None
    metadata: Optional[Dict] = None
    ingested_at: datetime = field(default_factory=datetime.utcnow)


class LogCache:
    """日志缓存管理器
    
    使用双端队列实现固定大小的滚动缓存
    新日志从右侧加入，超出容量时从左侧移除
    """
    
    def __init__(self, max_size: int = 200):
        self._max_size = max_size
        self._cache: deque = deque(maxlen=max_size)
        self._lock = asyncio.Lock()
        self._listeners: List[callable] = []
        self._id_counter = 0
        
    async def add_log(self, log: Dict[str, Any]) -> CachedLogEntry:
        """添加日志到缓存
        
        Args:
            log: 日志字典
            
        Returns:
            缓存的日志条目
        """
        async with self._lock:
            self._id_counter += 1
            
            entry = CachedLogEntry(
                id=f"cache_{self._id_counter}",
                timestamp=log.get('timestamp', datetime.utcnow().isoformat()),
                level=log.get('level', 'INFO'),
                module=log.get('module', 'unknown'),
                message=log.get('message', ''),
                source_file=log.get('source_file'),
                source_line=log.get('source_line'),
                function_name=log.get('function_name'),
                exception_type=log.get('exception_type'),
                exception_message=log.get('exception_message'),
                metadata=log.get('metadata')
            )
            
            self._cache.append(entry)
            
        # 通知监听器有新日志
        await self._notify_listeners(entry)
        
        return entry
    
    async def add_logs(self, logs: List[Dict[str, Any]]) -> List[CachedLogEntry]:
        """批量添加日志到缓存"""
        entries = []
        for log in logs:
            entry = await self.add_log(log)
            entries.append(entry)
        return entries
    
    async def get_logs(
        self,
        level: Optional[str] = None,
        module: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """从缓存查询日志
        
        Args:
            level: 日志级别筛选
            module: 模块筛选
            search: 搜索关键词
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            包含items, total, has_more的字典
        """
        async with self._lock:
            # 从最新的日志开始筛选（双端队列右侧是最新的）
            filtered = []
            for entry in reversed(self._cache):
                # 级别筛选
                if level and entry.level.upper() != level.upper():
                    continue
                    
                # 模块筛选
                if module and module.lower() not in entry.module.lower():
                    continue
                    
                # 搜索关键词
                if search:
                    search_lower = search.lower()
                    if (search_lower not in entry.message.lower() and 
                        search_lower not in entry.module.lower()):
                        continue
                
                filtered.append(entry)
            
            total = len(filtered)
            
            # 分页
            start = offset
            end = offset + limit
            page_items = filtered[start:end]
            
            # 转换为字典列表
            items = [
                {
                    "id": entry.id,
                    "timestamp": entry.timestamp,
                    "level": entry.level,
                    "module": entry.module,
                    "message": entry.message,
                    "source_file": entry.source_file,
                    "source_line": entry.source_line,
                    "function_name": entry.function_name,
                    "exception_type": entry.exception_type,
                    "exception_message": entry.exception_message,
                    "metadata": entry.metadata
                }
                for entry in page_items
            ]
            
            return {
                "items": items,
                "total": total,
                "has_more": end < total,
                "from_cache": True
            }
    
    async def get_recent_logs(self, count: int = 50) -> List[Dict[str, Any]]:
        """获取最近的N条日志（用于快速加载）"""
        result = await self.get_logs(limit=count, offset=0)
        return result["items"]
    
    async def get_stats(self) -> Dict[str, int]:
        """获取缓存中的日志统计"""
        async with self._lock:
            stats = {
                "total": len(self._cache),
                "error_count": 0,
                "warn_count": 0,
                "info_count": 0,
                "debug_count": 0
            }
            
            for entry in self._cache:
                level = entry.level.upper()
                if level == "ERROR":
                    stats["error_count"] += 1
                elif level == "WARNING" or level == "WARN":
                    stats["warn_count"] += 1
                elif level == "INFO":
                    stats["info_count"] += 1
                elif level == "DEBUG":
                    stats["debug_count"] += 1
                    
            return stats
    
    async def clear(self):
        """清空缓存"""
        async with self._lock:
            self._cache.clear()
            self._id_counter = 0
    
    async def add_listener(self, callback: callable):
        """添加新日志监听器"""
        if callback not in self._listeners:
            self._listeners.append(callback)
    
    async def remove_listener(self, callback: callable):
        """移除监听器"""
        if callback in self._listeners:
            self._listeners.remove(callback)
    
    async def _notify_listeners(self, entry: CachedLogEntry):
        """通知所有监听器有新日志"""
        log_dict = {
            "id": entry.id,
            "timestamp": entry.timestamp,
            "level": entry.level,
            "module": entry.module,
            "message": entry.message,
            "source_file": entry.source_file,
            "source_line": entry.source_line,
            "function_name": entry.function_name,
            "exception_type": entry.exception_type,
            "exception_message": entry.exception_message,
            "metadata": entry.metadata
        }
        
        for callback in self._listeners:
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(log_dict))
                else:
                    callback(log_dict)
            except Exception:
                pass
    
    @property
    def size(self) -> int:
        """当前缓存大小"""
        return len(self._cache)
    
    @property
    def max_size(self) -> int:
        """缓存最大容量"""
        return self._max_size


# 全局缓存实例
_cache_instance: Optional[LogCache] = None


async def get_log_cache(max_size: int = 200) -> LogCache:
    """获取日志缓存实例（单例）"""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = LogCache(max_size=max_size)
    return _cache_instance
