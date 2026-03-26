"""WebSocket 会话管理器"""
import asyncio
import json
from typing import Dict, Optional, List
from datetime import datetime, timedelta

from ..models.session import WebSocketSession, RealtimeMessage, AIAssistantSession
from ..protocol.constants import SessionStatus, DEFAULT_SESSION_TIMEOUT
from shared_core import get_db


class SessionManager:
    """WebSocket 会话管理器"""

    def __init__(self):
        # 内存中的活跃会话: session_id -> WebSocketSession
        self.active_sessions: Dict[str, WebSocketSession] = {}
        # 会话超时时间（秒）
        self.session_timeout = DEFAULT_SESSION_TIMEOUT

    async def create_session(
        self,
        session_type: str,
        connection_id: str,
        context_id: Optional[str] = None,
        model_config: Optional[dict] = None,
        user_id: str = "local"
    ) -> WebSocketSession:
        """
        创建新会话

        Args:
            session_type: 会话类型
            connection_id: 关联的连接 ID
            context_id: 上下文 ID（如 character_id, agent_id）
            model_config: 模型配置
            user_id: 用户 ID

        Returns:
            创建的会话对象
        """
        session = WebSocketSession(
            session_type=session_type,
            user_id=user_id,
            connection_id=connection_id,
            context_id=context_id,
            model_configuration=model_config,
            status=SessionStatus.ACTIVE
        )
        session.update_activity()

        # 保存到内存
        self.active_sessions[session.id] = session

        # 保存到数据库
        await self._save_session_to_db(session)

        # 如果是 AI 助手会话，同时创建 AI 助手会话记录
        if session_type == "ai_assistant":
            await self._create_ai_assistant_session(session.id)

        return session

    async def get_session(self, session_id: str) -> Optional[WebSocketSession]:
        """
        获取会话

        Args:
            session_id: 会话 ID

        Returns:
            会话对象，如果不存在则返回 None
        """
        # 先从内存获取
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            # 检查是否过期
            if session.status == SessionStatus.ACTIVE:
                if session.last_activity_at:
                    timeout = timedelta(seconds=self.session_timeout)
                    if datetime.now() - session.last_activity_at > timeout:
                        await self.close_session(session_id, "timeout")
                        return None
            return session

        # 从数据库获取
        return await self._load_session_from_db(session_id)

    async def close_session(self, session_id: str, reason: str = "user_exit"):
        """
        关闭会话

        Args:
            session_id: 会话 ID
            reason: 关闭原因
        """
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            session.close(reason)

            # 更新数据库
            await self._update_session_in_db(session)

            # 从内存移除
            del self.active_sessions[session_id]

    async def update_session_activity(self, session_id: str):
        """更新会话活动时间"""
        if session_id in self.active_sessions:
            self.active_sessions[session_id].update_activity()
            # 异步更新数据库
            asyncio.create_task(
                self._update_session_activity_in_db(session_id)
            )

    async def save_message(self, message: RealtimeMessage) -> int:
        """
        保存实时消息

        Args:
            message: 消息对象

        Returns:
            消息 ID
        """
        db = get_db()

        query = """
            INSERT INTO realtime_messages (
                session_id, message_type, role, content, content_chunks,
                tokens_used, latency_ms, model_name, provider,
                is_streaming, streaming_status, metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        params = (
            message.session_id,
            message.message_type,
            message.role,
            message.content,
            message.content_chunks,
            message.tokens_used,
            message.latency_ms,
            message.model_name,
            message.provider,
            message.is_streaming,
            message.streaming_status,
            json.dumps(message.metadata) if message.metadata else None,
            message.created_at
        )

        result = await db.execute(query, params)
        return result.lastrowid

    async def get_session_messages(
        self,
        session_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[RealtimeMessage]:
        """获取会话消息历史"""
        db = get_db()

        query = """
            SELECT * FROM realtime_messages
            WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """

        rows = await db.fetchall(query, (session_id, limit, offset))

        messages = []
        for row in rows:
            msg = RealtimeMessage(
                id=row["id"],
                session_id=row["session_id"],
                message_type=row["message_type"],
                role=row["role"],
                content=row["content"],
                content_chunks=row["content_chunks"],
                tokens_used=row["tokens_used"],
                latency_ms=row["latency_ms"],
                model_name=row["model_name"],
                provider=row["provider"],
                is_streaming=row["is_streaming"],
                streaming_status=row["streaming_status"],
                metadata=json.loads(row["metadata"]) if row["metadata"] else {},
                created_at=row["created_at"]
            )
            messages.append(msg)

        return messages

    async def get_active_sessions_by_connection(self, connection_id: str) -> List[WebSocketSession]:
        """获取连接的所有活跃会话"""
        sessions = []
        for session in self.active_sessions.values():
            if session.connection_id == connection_id and session.status == SessionStatus.ACTIVE:
                sessions.append(session)
        return sessions

    async def cleanup_expired_sessions(self):
        """清理过期会话"""
        now = datetime.now()
        timeout = timedelta(seconds=self.session_timeout)

        expired_sessions = []
        for session_id, session in self.active_sessions.items():
            if session.status == SessionStatus.ACTIVE and session.last_activity_at:
                if now - session.last_activity_at > timeout:
                    expired_sessions.append(session_id)

        for session_id in expired_sessions:
            await self.close_session(session_id, "timeout")

    # 数据库操作

    async def _save_session_to_db(self, session: WebSocketSession):
        """保存会话到数据库"""
        db = get_db()

        query = """
            INSERT INTO websocket_sessions (
                id, session_type, user_id, connection_id, status,
                context_id, model_config, metadata, last_activity_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        params = (
            session.id,
            session.session_type,
            session.user_id,
            session.connection_id,
            session.status,
            session.context_id,
            json.dumps(session.model_configuration) if session.model_configuration else None,
            json.dumps(session.metadata) if session.metadata else None,
            session.last_activity_at,
            session.created_at
        )

        await db.execute(query, params)

    async def _load_session_from_db(self, session_id: str) -> Optional[WebSocketSession]:
        """从数据库加载会话"""
        db = get_db()

        query = "SELECT * FROM websocket_sessions WHERE id = ?"
        row = await db.fetchone(query, (session_id,))

        if not row:
            return None

        session = WebSocketSession(
            id=row["id"],
            session_type=row["session_type"],
            user_id=row["user_id"],
            connection_id=row["connection_id"],
            status=row["status"],
            context_id=row["context_id"],
            model_configuration=json.loads(row["model_config"]) if row["model_config"] else None,
            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
            last_activity_at=row["last_activity_at"],
            created_at=row["created_at"],
            closed_at=row["closed_at"]
        )

        return session

    async def _update_session_in_db(self, session: WebSocketSession):
        """更新会话到数据库"""
        db = get_db()

        query = """
            UPDATE websocket_sessions
            SET status = ?, metadata = ?, closed_at = ?
            WHERE id = ?
        """

        params = (
            session.status,
            json.dumps(session.metadata) if session.metadata else None,
            session.closed_at,
            session.id
        )

        await db.execute(query, params)

    async def _update_session_activity_in_db(self, session_id: str):
        """更新会话活动时间到数据库"""
        db = get_db()

        query = """
            UPDATE websocket_sessions
            SET last_activity_at = ?
            WHERE id = ?
        """

        await db.execute(query, (datetime.now(), session_id))

    async def _create_ai_assistant_session(self, websocket_session_id: str):
        """创建 AI 助手会话记录"""
        db = get_db()

        ai_session = AIAssistantSession(
            websocket_session_id=websocket_session_id,
            title="新对话"
        )

        query = """
            INSERT INTO ai_assistant_sessions (
                id, websocket_session_id, title, message_count,
                last_message_at, is_pinned, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """

        params = (
            ai_session.id,
            ai_session.websocket_session_id,
            ai_session.title,
            ai_session.message_count,
            ai_session.last_message_at,
            ai_session.is_pinned,
            ai_session.created_at
        )

        await db.execute(query, params)


# 全局会话管理器实例
session_manager = SessionManager()


def get_session_manager() -> SessionManager:
    """获取会话管理器实例"""
    return session_manager
