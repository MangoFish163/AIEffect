from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from shared_core import get_config_manager, setup_logger, get_logger, get_db
from shared_core.database import init_db, close_db
from .models.schemas import HealthResponse, PortsResponse, BaseResponse
from .api import config as config_router, providers, proxy, tts, subtitle, memory, logs, asr, agents, files, system, characters, ai_assistant
from .api.config import _init_default_config
from .services.proxy_service import get_proxy_service
from .services.tts_service import get_tts_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logger()
    logger = get_logger(__name__)
    logger.info("AIEffect API Gateway starting...")
    await init_db()
    logger.info("Database initialized")
    # 初始化默认配置
    await _init_default_config()
    logger.info("Default config initialized")
    config_manager = get_config_manager()
    logger.info(f"Config loaded. Ports: {config_manager.config.ports}")
    yield
    await close_db()
    logger.info("AIEffect API Gateway shutting down...")


app = FastAPI(
    title="AIEffect API Gateway",
    description="AI Effect API Gateway - AI Voice Interaction Adapter",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8500",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8500",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(config_router.router)
app.include_router(providers.router)
app.include_router(proxy.router)
app.include_router(tts.router)
app.include_router(subtitle.router)
app.include_router(memory.router)
app.include_router(logs.router)
app.include_router(asr.router)
app.include_router(agents.router)
app.include_router(files.router)
app.include_router(system.router)
app.include_router(characters.router)
app.include_router(ai_assistant.router)


@app.get("/api/health", response_model=BaseResponse)
async def health_check():
    """
    健康检查端点 - 轻量级实现
    只检查服务是否存活，不执行耗时操作
    """
    response_data = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "service": "api-gateway"
    }
    return BaseResponse(data=response_data)


@app.get("/api/ports", response_model=BaseResponse)
async def get_ports():
    try:
        config_manager = get_config_manager()
        ports = config_manager.config.ports
        return BaseResponse(data={
            "api": ports.api,
            "ollama_proxy": ports.ollama_proxy,
            "websocket": ports.websocket,
            "subtitle": ports.subtitle,
            "tts": ports.tts,
            "log": ports.log,
        })
    except Exception as e:
        get_logger(__name__).error(f"Error getting ports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 全局 server 实例，用于优雅关闭
_uvicorn_server = None

def get_server():
    """获取 uvicorn server 实例"""
    global _uvicorn_server
    return _uvicorn_server


@app.post("/api/shutdown")
async def shutdown():
    """优雅关闭服务"""
    import asyncio
    import os

    logger = get_logger(__name__)
    logger.info("Shutdown requested, stopping server...")

    async def do_shutdown():
        # 给响应一些时间返回
        await asyncio.sleep(0.5)
        # 尝试通过 server 实例优雅关闭
        try:
            server = get_server()
            if server and hasattr(server, 'should_exit'):
                server.should_exit = True
                logger.info("Server should_exit set to True")
                return
        except Exception:
            pass
        
        # 备选方案：使用 os._exit 避免异常堆栈
        os._exit(0)

    # 启动关闭任务
    asyncio.create_task(do_shutdown())

    return {"status": "shutting_down", "message": "Service is shutting down gracefully"}


if __name__ == "__main__":
    import uvicorn
    import logging
    
    # 配置访问日志过滤器，跳过健康检查端点
    class HealthCheckFilter(logging.Filter):
        def filter(self, record):
            # 过滤掉健康检查端点的访问日志
            if hasattr(record, 'args') and len(record.args) >= 3:
                path = str(record.args[2]) if len(record.args) > 2 else ""
                if path == "/api/health" or path.startswith("/api/health"):
                    return False
            return True
    
    # 获取 uvicorn 访问日志记录器并添加过滤器
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.addFilter(HealthCheckFilter())
    
    config_manager = get_config_manager()
    port = config_manager.config.ports.api
    host = "0.0.0.0" if config_manager.config.lan_enabled else "127.0.0.1"
    
    config = uvicorn.Config(
        "api_gateway.main:app",
        host=host,
        port=port,
        reload=True,
    )
    _uvicorn_server = uvicorn.Server(config)
    _uvicorn_server.run()
