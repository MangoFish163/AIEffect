"""WebSocket 连接管理器"""
import asyncio
import uuid
from typing import Dict, Optional, Set
from datetime import datetime, timedelta
from fastapi import WebSocket
import json

from ..protocol.constants import DEFAULT_HEARTBEAT_INTERVAL, DEFAULT_MAX_CONNECTIONS
from ..protocol.constants import MessageType, ErrorCode
from ..protocol.schemas import BaseMessage, ConnectionAckData, PongData, ErrorData


class ConnectionManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        # 活跃连接字典: connection_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # 连接元数据: connection_id -> 连接信息
        self.connection_info: Dict[str, dict] = {}
        # 连接会话映射: connection_id -> Set[session_id]
        self.connection_sessions: Dict[str, Set[str]] = {}
        # 最大连接数
        self.max_connections = DEFAULT_MAX_CONNECTIONS
        # 心跳间隔
        self.heartbeat_interval = DEFAULT_HEARTBEAT_INTERVAL
        # 最后心跳时间
        self.last_heartbeat: Dict[str, datetime] = {}

    async def connect(self, websocket: WebSocket) -> Optional[str]:
        """
        接受新的 WebSocket 连接

        Args:
            websocket: WebSocket 对象

        Returns:
            连接 ID，如果连接数达到上限则返回 None
        """
        if len(self.active_connections) >= self.max_connections:
            await websocket.close(code=1008, reason="Server capacity reached")
            return None

        await websocket.accept()

        connection_id = str(uuid.uuid4())
        self.active_connections[connection_id] = websocket
        self.connection_info[connection_id] = {
            "connected_at": datetime.now().isoformat(),
            "client_version": "unknown",
            "capabilities": []
        }
        self.connection_sessions[connection_id] = set()
        self.last_heartbeat[connection_id] = datetime.now()

        return connection_id

    async def disconnect(self, connection_id: str):
        """
        断开 WebSocket 连接

        Args:
            connection_id: 连接 ID
        """
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            try:
                await websocket.close()
            except Exception:
                pass

            del self.active_connections[connection_id]

        # 清理相关数据
        self.connection_info.pop(connection_id, None)
        self.connection_sessions.pop(connection_id, None)
        self.last_heartbeat.pop(connection_id, None)

    async def send_message(self, connection_id: str, message: dict):
        """
        向指定连接发送消息

        Args:
            connection_id: 连接 ID
            message: 消息字典
        """
        if connection_id not in self.active_connections:
            return

        websocket = self.active_connections[connection_id]
        try:
            await websocket.send_json(message)
        except Exception as e:
            # 发送失败，标记连接可能已断开
            await self.disconnect(connection_id)

    async def broadcast(self, message: dict, exclude: Optional[str] = None):
        """
        广播消息给所有连接

        Args:
            message: 消息字典
            exclude: 排除的连接 ID
        """
        disconnected = []
        for connection_id, websocket in self.active_connections.items():
            if connection_id == exclude:
                continue

            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(connection_id)

        # 清理断开的连接
        for connection_id in disconnected:
            await self.disconnect(connection_id)

    def get_connection_info(self, connection_id: str) -> Optional[dict]:
        """获取连接信息"""
        return self.connection_info.get(connection_id)

    def update_connection_info(self, connection_id: str, **kwargs):
        """更新连接信息"""
        if connection_id in self.connection_info:
            self.connection_info[connection_id].update(kwargs)

    def add_session_to_connection(self, connection_id: str, session_id: str):
        """将会话关联到连接"""
        if connection_id in self.connection_sessions:
            self.connection_sessions[connection_id].add(session_id)

    def remove_session_from_connection(self, connection_id: str, session_id: str):
        """从连接中移除会话关联"""
        if connection_id in self.connection_sessions:
            self.connection_sessions[connection_id].discard(session_id)

    def get_connection_sessions(self, connection_id: str) -> Set[str]:
        """获取连接关联的所有会话"""
        return self.connection_sessions.get(connection_id, set())

    def update_heartbeat(self, connection_id: str):
        """更新心跳时间"""
        self.last_heartbeat[connection_id] = datetime.now()

    async def check_heartbeats(self):
        """检查心跳，断开超时的连接"""
        now = datetime.now()
        timeout = timedelta(seconds=self.heartbeat_interval * 2)

        disconnected = []
        for connection_id, last_beat in self.last_heartbeat.items():
            if now - last_beat > timeout:
                disconnected.append(connection_id)

        for connection_id in disconnected:
            await self.disconnect(connection_id)

    def get_active_connection_count(self) -> int:
        """获取活跃连接数"""
        return len(self.active_connections)

    async def send_connection_ack(self, connection_id: str):
        """发送连接确认消息"""
        ack_data = ConnectionAckData(
            connection_id=connection_id,
            server_version="1.0.0",
            heartbeat_interval=self.heartbeat_interval * 1000  # 转换为毫秒
        )

        message = BaseMessage(
            type=MessageType.CONNECTION_ACK,
            data=ack_data.dict()
        )

        await self.send_message(connection_id, message.dict())

    async def send_pong(self, connection_id: str, timestamp: int):
        """发送心跳响应"""
        pong_data = PongData(timestamp=timestamp)

        message = BaseMessage(
            type=MessageType.PONG,
            data=pong_data.dict()
        )

        await self.send_message(connection_id, message.dict())

    async def send_error(self, connection_id: str, code: ErrorCode, message: str, details: Optional[dict] = None):
        """发送错误消息"""
        error_data = ErrorData(
            code=code.value,
            message=message,
            details=details
        )

        msg = BaseMessage(
            type=MessageType.ERROR,
            data=error_data.dict()
        )

        await self.send_message(connection_id, msg.dict())


# 全局连接管理器实例
connection_manager = ConnectionManager()


def get_connection_manager() -> ConnectionManager:
    """获取连接管理器实例"""
    return connection_manager
