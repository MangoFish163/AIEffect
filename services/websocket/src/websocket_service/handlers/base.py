"""WebSocket 处理器基类"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime
import json
import httpx

from ..protocol.constants import MessageType, ErrorCode
from ..protocol.schemas import BaseMessage, ChatChunkData, ChatCompletedData, TokenUsage
from ..models.session import RealtimeMessage
from shared_core import get_config_manager, get_logger


class BaseHandler(ABC):
    """WebSocket 处理器基类"""

    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)

    @abstractmethod
    async def handle_message(
        self,
        session_id: str,
        connection_id: str,
        message: BaseMessage,
        send_callback
    ):
        """
        处理消息

        Args:
            session_id: 会话 ID
            connection_id: 连接 ID
            message: 消息对象
            send_callback: 发送消息回调函数
        """
        pass

    @abstractmethod
    def get_session_type(self) -> str:
        """获取处理器支持的会话类型"""
        pass

    async def send_chunk(
        self,
        session_id: str,
        message_id: str,
        content: str,
        finish_reason: Optional[str] = None,
        usage: Optional[TokenUsage] = None,
        send_callback=None
    ):
        """发送消息块"""
        chunk_data = ChatChunkData(
            message_id=message_id,
            content=content,
            finish_reason=finish_reason,
            usage=usage
        )

        message = BaseMessage(
            type=MessageType.CHAT_CHUNK,
            session_id=session_id,
            data=chunk_data.dict()
        )

        if send_callback:
            await send_callback(message.dict())

    async def send_completed(
        self,
        session_id: str,
        message_id: str,
        full_content: str,
        finish_reason: str,
        usage: TokenUsage,
        send_callback=None
    ):
        """发送消息完成通知"""
        completed_data = ChatCompletedData(
            message_id=message_id,
            full_content=full_content,
            finish_reason=finish_reason,
            usage=usage
        )

        message = BaseMessage(
            type=MessageType.CHAT_COMPLETED,
            session_id=session_id,
            data=completed_data.dict()
        )

        if send_callback:
            await send_callback(message.dict())

    async def save_message(
        self,
        session_manager,
        session_id: str,
        role: str,
        content: str,
        is_streaming: bool = False,
        streaming_status: Optional[str] = None,
        tokens_used: Optional[int] = None,
        model_name: Optional[str] = None,
        provider: Optional[str] = None,
        latency_ms: Optional[int] = None,
        content_chunks: Optional[list] = None
    ) -> int:
        """保存消息到数据库"""
        message = RealtimeMessage(
            session_id=session_id,
            role=role,
            content=content,
            is_streaming=is_streaming,
            streaming_status=streaming_status,
            tokens_used=tokens_used,
            model_name=model_name,
            provider=provider,
            latency_ms=latency_ms,
            content_chunks=json.dumps(content_chunks) if content_chunks else None
        )

        return await session_manager.save_message(message)

    def get_model_config(self) -> Optional[Dict[str, Any]]:
        """获取模型配置"""
        try:
            config_manager = get_config_manager()
            api_config = config_manager.config.api

            if not api_config.api_url or not api_config.model_name:
                return None

            return {
                "provider": api_config.provider,
                "api_url": api_config.api_url,
                "api_key": api_config.api_key,
                "model": api_config.model_name
            }
        except Exception as e:
            self.logger.error(f"Error getting model config: {e}")
            return None

    async def call_llm_api(
        self,
        messages: list,
        model_config: dict,
        stream: bool = True,
        temperature: float = 0.7,
        max_tokens: int = 2000
    ):
        """
        调用 LLM API

        Args:
            messages: 消息列表
            model_config: 模型配置
            stream: 是否流式输出
            temperature: 温度参数
            max_tokens: 最大 token 数

        Yields:
            流式响应块
        """
        api_url = model_config["api_url"].rstrip("/")
        api_key = model_config.get("api_key", "")
        model = model_config["model"]

        headers = {
            "Content-Type": "application/json"
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        request_data = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            if stream:
                async with client.stream(
                    "POST",
                    f"{api_url}/chat/completions",
                    headers=headers,
                    json=request_data
                ) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                yield chunk
                            except json.JSONDecodeError:
                                continue
            else:
                response = await client.post(
                    f"{api_url}/chat/completions",
                    headers=headers,
                    json=request_data
                )
                response.raise_for_status()
                yield response.json()
