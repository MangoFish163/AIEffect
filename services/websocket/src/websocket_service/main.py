"""WebSocket 服务入口"""
import asyncio
import json
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .protocol.constants import MessageType, ErrorCode, DEFAULT_HEARTBEAT_INTERVAL
from .protocol.schemas import BaseMessage, ConnectionInitData, PingData
from .connection.manager import get_connection_manager
from .session.manager import get_session_manager
from .handlers.ai_assistant import AIAssistantHandler
from .handlers.agent_chat import AgentChatHandler
from shared_core import get_config_manager, setup_logger, get_logger, get_db


# 处理器注册表
HANDLERS = {
    "ai_assistant": AIAssistantHandler(),
    "agent_chat": AgentChatHandler(),
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动
    setup_logger()
    logger = get_logger(__name__)
    logger.info("WebSocket Service starting...")

    # 初始化数据库
    db = get_db()
    await db.init()
    logger.info("Database initialized")

    # 启动心跳检查任务
    heartbeat_task = asyncio.create_task(heartbeat_checker())

    yield

    # 关闭
    heartbeat_task.cancel()
    logger.info("WebSocket Service shutting down...")


app = FastAPI(
    title="AIEffect WebSocket Service",
    description="AI Effect WebSocket Service - Real-time AI Conversation",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def heartbeat_checker():
    """心跳检查任务"""
    while True:
        try:
            await asyncio.sleep(DEFAULT_HEARTBEAT_INTERVAL)

            connection_manager = get_connection_manager()
            session_manager = get_session_manager()

            # 检查连接心跳
            await connection_manager.check_heartbeats()

            # 清理过期会话
            await session_manager.cleanup_expired_sessions()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger = get_logger(__name__)
            logger.error(f"Heartbeat checker error: {e}")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket 连接端点"""
    connection_manager = get_connection_manager()
    session_manager = get_session_manager()
    logger = get_logger(__name__)

    # 接受连接
    connection_id = await connection_manager.connect(websocket)
    if not connection_id:
        return

    logger.info(f"WebSocket connection established: {connection_id}")

    # 发送连接确认
    await connection_manager.send_connection_ack(connection_id)

    try:
        while True:
            # 接收消息
            data = await websocket.receive_text()

            try:
                message_data = json.loads(data)
                message = BaseMessage(**message_data)
            except json.JSONDecodeError as e:
                await connection_manager.send_error(
                    connection_id,
                    ErrorCode.INVALID_MESSAGE,
                    f"Invalid JSON: {str(e)}"
                )
                continue
            except Exception as e:
                await connection_manager.send_error(
                    connection_id,
                    ErrorCode.INVALID_MESSAGE,
                    f"Invalid message format: {str(e)}"
                )
                continue

            # 处理消息
            await handle_message(connection_id, message, websocket)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # 清理连接
        await cleanup_connection(connection_id)


async def handle_message(connection_id: str, message: BaseMessage, websocket: WebSocket):
    """处理消息"""
    connection_manager = get_connection_manager()
    logger = get_logger(__name__)

    msg_type = message.type
    session_id = message.session_id

    # 更新心跳
    connection_manager.update_heartbeat(connection_id)

    # 处理连接相关消息
    if msg_type == MessageType.CONNECTION_INIT:
        await handle_connection_init(connection_id, message)
        return

    if msg_type == MessageType.PING:
        await handle_ping(connection_id, message)
        return

    # 处理会话相关消息
    if msg_type == MessageType.SESSION_CREATE:
        await handle_session_create(connection_id, message, websocket)
        return

    # 需要会话 ID 的消息
    if not session_id:
        await connection_manager.send_error(
            connection_id,
            ErrorCode.INVALID_MESSAGE,
            "Session ID is required"
        )
        return

    # 获取会话
    session_manager = get_session_manager()
    session = await session_manager.get_session(session_id)

    if not session:
        await connection_manager.send_error(
            connection_id,
            ErrorCode.SESSION_NOT_FOUND,
            f"Session not found: {session_id}"
        )
        return

    # 检查会话是否属于当前连接
    if session.connection_id != connection_id:
        await connection_manager.send_error(
            connection_id,
            ErrorCode.UNAUTHORIZED,
            "Session does not belong to this connection"
        )
        return

    # 获取处理器
    handler = HANDLERS.get(session.session_type)
    if not handler:
        await connection_manager.send_error(
            connection_id,
            ErrorCode.INTERNAL_ERROR,
            f"No handler for session type: {session.session_type}"
        )
        return

    # 处理消息
    async def send_callback(data: dict):
        await websocket.send_json(data)

    try:
        await handler.handle_message(
            session_id=session_id,
            connection_id=connection_id,
            message=message,
            send_callback=send_callback
        )
    except Exception as e:
        logger.error(f"Error handling message: {e}")
        await connection_manager.send_error(
            connection_id,
            ErrorCode.INTERNAL_ERROR,
            f"Error handling message: {str(e)}"
        )


async def handle_connection_init(connection_id: str, message: BaseMessage):
    """处理连接初始化"""
    connection_manager = get_connection_manager()

    try:
        init_data = ConnectionInitData(**message.data)
        connection_manager.update_connection_info(
            connection_id,
            client_version=init_data.client_version,
            capabilities=init_data.capabilities
        )
    except Exception as e:
        await connection_manager.send_error(
            connection_id,
            ErrorCode.INVALID_MESSAGE,
            f"Invalid connection init data: {str(e)}"
        )


async def handle_ping(connection_id: str, message: BaseMessage):
    """处理心跳"""
    connection_manager = get_connection_manager()

    try:
        ping_data = PingData(**message.data)
        await connection_manager.send_pong(connection_id, ping_data.timestamp)
    except Exception as e:
        await connection_manager.send_error(
            connection_id,
            ErrorCode.INVALID_MESSAGE,
            f"Invalid ping data: {str(e)}"
        )


async def handle_session_create(connection_id: str, message: BaseMessage, websocket: WebSocket):
    """处理会话创建"""
    connection_manager = get_connection_manager()
    logger = get_logger(__name__)

    session_type = message.data.get("session_type")
    if not session_type:
        await connection_manager.send_error(
            connection_id,
            ErrorCode.INVALID_MESSAGE,
            "Session type is required"
        )
        return

    # 获取处理器
    handler = HANDLERS.get(session_type)
    if not handler:
        await connection_manager.send_error(
            connection_id,
            ErrorCode.INVALID_MESSAGE,
            f"Unknown session type: {session_type}"
        )
        return

    # 处理会话创建
    async def send_callback(data: dict):
        await websocket.send_json(data)

    try:
        await handler.handle_message(
            session_id="",  # 新会话，ID 由处理器生成
            connection_id=connection_id,
            message=message,
            send_callback=send_callback
        )
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        await connection_manager.send_error(
            connection_id,
            ErrorCode.INTERNAL_ERROR,
            f"Error creating session: {str(e)}"
        )


async def cleanup_connection(connection_id: str):
    """清理连接"""
    connection_manager = get_connection_manager()
    session_manager = get_session_manager()
    logger = get_logger(__name__)

    # 获取连接的所有会话
    session_ids = connection_manager.get_connection_sessions(connection_id)

    # 关闭所有会话
    for session_id in session_ids:
        await session_manager.close_session(session_id, "connection_closed")
        logger.info(f"Session closed due to connection close: {session_id}")

    # 断开连接
    await connection_manager.disconnect(connection_id)
    logger.info(f"Connection cleaned up: {connection_id}")


@app.get("/health")
async def health_check():
    """健康检查"""
    from datetime import datetime
    connection_manager = get_connection_manager()

    return {
        "status": "healthy",
        "connections": connection_manager.get_active_connection_count(),
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    config_manager = get_config_manager()
    port = config_manager.config.ports.websocket

    uvicorn.run(
        "websocket_service.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )
