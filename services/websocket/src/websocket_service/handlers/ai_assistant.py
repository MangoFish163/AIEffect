"""AI 助手对话处理器"""
import json
import uuid
from typing import List, Dict, Any
from datetime import datetime

from .base import BaseHandler
from ..protocol.constants import MessageType, ErrorCode
from ..protocol.schemas import (
    BaseMessage, ChatMessageData, SessionCreatedData,
    SessionClosedData, ErrorData, TokenUsage
)
from shared_core import get_logger


class AIAssistantHandler(BaseHandler):
    """AI 助手对话处理器"""

    SYSTEM_PROMPT = """你是星野，是 AI Voice Bridge 的虚拟助手。你可以将文字变成有感情的声音，还能理解用户说的话。请用友好、亲切的语气回答用户的问题。"""

    MAX_HISTORY = 10

    def get_session_type(self) -> str:
        return "ai_assistant"

    async def handle_message(
        self,
        session_id: str,
        connection_id: str,
        message: BaseMessage,
        send_callback
    ):
        """处理 AI 助手消息"""
        msg_type = message.type

        if msg_type == MessageType.SESSION_CREATE:
            await self._handle_session_create(
                session_id, connection_id, message, send_callback
            )
        elif msg_type == MessageType.CHAT_MESSAGE:
            await self._handle_chat_message(
                session_id, connection_id, message, send_callback
            )
        elif msg_type == MessageType.SESSION_CLOSE:
            await self._handle_session_close(
                session_id, message, send_callback
            )
        else:
            self.logger.warning(f"Unknown message type: {msg_type}")

    async def _handle_session_create(
        self,
        session_id: str,
        connection_id: str,
        message: BaseMessage,
        send_callback
    ):
        """处理会话创建"""
        from ..session.manager import get_session_manager

        session_manager = get_session_manager()

        # 获取模型配置
        model_config = self.get_model_config()

        # 创建会话
        session = await session_manager.create_session(
            session_type="ai_assistant",
            connection_id=connection_id,
            model_config=model_config
        )

        # 发送会话创建成功消息
        created_data = SessionCreatedData(
            session_id=session.id,
            session_type="ai_assistant",
            created_at=session.created_at.isoformat()
        )

        response = BaseMessage(
            type=MessageType.SESSION_CREATED,
            data=created_data.dict()
        )

        await send_callback(response.dict())

        self.logger.info(f"AI Assistant session created: {session.id}")

    async def _handle_chat_message(
        self,
        session_id: str,
        connection_id: str,
        message: BaseMessage,
        send_callback
    ):
        """处理聊天消息"""
        from ..session.manager import get_session_manager
        from ..connection.manager import get_connection_manager

        session_manager = get_session_manager()
        connection_manager = get_connection_manager()

        # 获取会话
        session = await session_manager.get_session(session_id)
        if not session:
            await connection_manager.send_error(
                connection_id,
                ErrorCode.SESSION_NOT_FOUND,
                "会话不存在或已过期"
            )
            return

        # 解析消息数据
        try:
            chat_data = ChatMessageData(**message.data)
        except Exception as e:
            await connection_manager.send_error(
                connection_id,
                ErrorCode.INVALID_MESSAGE,
                f"消息格式错误: {str(e)}"
            )
            return

        # 检查模型配置
        model_config = session.model_configuration or self.get_model_config()
        if not model_config:
            await connection_manager.send_error(
                connection_id,
                ErrorCode.INTERNAL_ERROR,
                "AI 模型尚未配置。请在控制面板中配置 API 地址和模型名称。",
                details={"field": "api_url"}
            )
            return

        # 保存用户消息
        await self.save_message(
            session_manager,
            session_id,
            role="user",
            content=chat_data.content
        )

        # 更新会话活动
        await session_manager.update_session_activity(session_id)

        # 获取历史消息
        history = await self._get_recent_history(session_id)

        # 构建消息列表
        messages = self._build_messages(history, chat_data.content)

        # 调用 LLM
        start_time = datetime.now()
        full_content = ""
        content_chunks = []

        try:
            async for chunk in self.call_llm_api(
                messages=messages,
                model_config=model_config,
                stream=chat_data.streaming
            ):
                if "choices" in chunk and len(chunk["choices"]) > 0:
                    choice = chunk["choices"][0]
                    delta = choice.get("delta", {})
                    content = delta.get("content", "")

                    if content:
                        full_content += content
                        content_chunks.append(content)

                        # 发送流式块
                        await self.send_chunk(
                            session_id=session_id,
                            message_id=chat_data.message_id,
                            content=content,
                            send_callback=send_callback
                        )

                    # 检查是否完成
                    finish_reason = choice.get("finish_reason")
                    if finish_reason:
                        # 计算延迟
                        latency_ms = int((datetime.now() - start_time).total_seconds() * 1000)

                        # 获取 token 使用
                        usage_data = chunk.get("usage", {})
                        usage = TokenUsage(
                            prompt_tokens=usage_data.get("prompt_tokens", 0),
                            completion_tokens=usage_data.get("completion_tokens", 0),
                            total_tokens=usage_data.get("total_tokens", 0)
                        )

                        # 保存助手消息
                        await self.save_message(
                            session_manager,
                            session_id,
                            role="assistant",
                            content=full_content,
                            is_streaming=True,
                            streaming_status="completed",
                            tokens_used=usage.total_tokens,
                            model_name=model_config.get("model"),
                            provider=model_config.get("provider"),
                            latency_ms=latency_ms,
                            content_chunks=content_chunks
                        )

                        # 发送完成消息
                        await self.send_completed(
                            session_id=session_id,
                            message_id=chat_data.message_id,
                            full_content=full_content,
                            finish_reason=finish_reason,
                            usage=usage,
                            send_callback=send_callback
                        )

        except Exception as e:
            self.logger.error(f"Error calling LLM API: {e}")

            # 保存错误消息
            await self.save_message(
                session_manager,
                session_id,
                role="assistant",
                content=f"抱歉，调用 AI 服务时出错: {str(e)}",
                is_streaming=True,
                streaming_status="failed"
            )

            await connection_manager.send_error(
                connection_id,
                ErrorCode.INTERNAL_ERROR,
                f"AI 服务调用失败: {str(e)}"
            )

    async def _handle_session_close(
        self,
        session_id: str,
        message: BaseMessage,
        send_callback
    ):
        """处理会话关闭"""
        from ..session.manager import get_session_manager

        session_manager = get_session_manager()

        # 关闭会话
        reason = message.data.get("reason", "user_exit")
        await session_manager.close_session(session_id, reason)

        # 发送会话关闭消息
        closed_data = SessionClosedData(
            session_id=session_id,
            reason=reason,
            closed_at=datetime.now().isoformat()
        )

        response = BaseMessage(
            type=MessageType.SESSION_CLOSED,
            data=closed_data.dict()
        )

        await send_callback(response.dict())

        self.logger.info(f"AI Assistant session closed: {session_id}")

    async def _get_recent_history(self, session_id: str) -> List[Dict[str, Any]]:
        """获取最近的历史消息"""
        from ..session.manager import get_session_manager

        session_manager = get_session_manager()
        messages = await session_manager.get_session_messages(
            session_id,
            limit=self.MAX_HISTORY
        )

        # 转换为简单字典列表
        history = []
        for msg in reversed(messages):  # 按时间正序
            history.append({
                "role": msg.role,
                "content": msg.content
            })

        return history

    def _build_messages(
        self,
        history: List[Dict[str, Any]],
        current_content: str
    ) -> List[Dict[str, Any]]:
        """构建消息列表"""
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT}
        ]

        # 添加历史消息
        for h in history:
            messages.append({
                "role": h.get("role", "user"),
                "content": h.get("content", "")
            })

        # 添加当前消息
        messages.append({"role": "user", "content": current_content})

        return messages
