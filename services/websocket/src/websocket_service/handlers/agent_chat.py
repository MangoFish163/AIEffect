"""Agent 对话处理器"""
from typing import Optional
from datetime import datetime

from .base import BaseHandler
from ..protocol.constants import MessageType, ErrorCode
from ..protocol.schemas import (
    BaseMessage, ChatMessageData, SessionCreatedData,
    SessionClosedData, AgentResponseData, TokenUsage
)


class AgentChatHandler(BaseHandler):
    """Agent 对话处理器"""

    def get_session_type(self) -> str:
        return "agent_chat"

    async def handle_message(
        self,
        session_id: str,
        connection_id: str,
        message: BaseMessage,
        send_callback
    ):
        """处理 Agent 对话消息"""
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

        # 获取上下文 ID (Agent ID)
        context_id = message.data.get("context_id")
        model_config = message.data.get("model_config")

        # 创建会话
        session = await session_manager.create_session(
            session_type="agent_chat",
            connection_id=connection_id,
            context_id=context_id,
            model_config=model_config
        )

        # 发送会话创建成功消息
        created_data = SessionCreatedData(
            session_id=session.id,
            session_type="agent_chat",
            created_at=session.created_at.isoformat()
        )

        response = BaseMessage(
            type=MessageType.SESSION_CREATED,
            data=created_data.dict()
        )

        await send_callback(response.dict())

        self.logger.info(f"Agent chat session created: {session.id}, agent: {context_id}")

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

        # 获取 Agent 信息
        agent_id = session.context_id
        if not agent_id:
            await connection_manager.send_error(
                connection_id,
                ErrorCode.INVALID_MESSAGE,
                "未指定 Agent ID"
            )
            return

        # 检查模型配置
        model_config = session.model_configuration or self.get_model_config()
        if not model_config:
            await connection_manager.send_error(
                connection_id,
                ErrorCode.INTERNAL_ERROR,
                "AI 模型尚未配置"
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

        # 获取 Agent 系统提示词
        system_prompt = await self._get_agent_system_prompt(agent_id)

        # 构建消息列表
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": chat_data.content}
        ]

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

                        # 发送 Agent 响应
                        response_data = AgentResponseData(
                            agent_id=agent_id,
                            message_id=chat_data.message_id,
                            content=full_content
                        )

                        response = BaseMessage(
                            type=MessageType.AGENT_RESPONSE,
                            session_id=session_id,
                            data=response_data.dict()
                        )

                        await send_callback(response.dict())

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

        self.logger.info(f"Agent chat session closed: {session_id}")

    async def _get_agent_system_prompt(self, agent_id: str) -> str:
        """获取 Agent 系统提示词"""
        from shared_core import get_db

        db = get_db()

        # 查询 Agent 信息
        query = "SELECT * FROM agents WHERE id = ?"
        row = await db.fetchone(query, (agent_id,))

        if not row:
            return f"你是 Agent {agent_id}，请帮助用户解决问题。"

        role = row.get("role", "助手")
        display_name = row.get("display_name", agent_id)

        return f"你是{display_name}，职责是{role}。请用专业、友好的态度回答用户的问题。"
