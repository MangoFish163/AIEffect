from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .core.config import get_config_manager
from .core.logger import setup_logger, get_logger
from .core.database import get_db
from .models.schemas import HealthResponse, PortsResponse, BaseResponse
from .api import config, providers, proxy, tts, subtitle, memory, logs, asr, agents, files, system, characters
from .services.proxy_service import get_proxy_service
from .services.tts_service import get_tts_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logger()
    logger = get_logger(__name__)
    logger.info("AIEffect Backend starting...")
    db = get_db()
    await db.init()
    logger.info("Database initialized")
    config_manager = get_config_manager()
    logger.info(f"Config loaded. Ports: {config_manager.config.ports}")
    yield
    await db.close()
    logger.info("AIEffect Backend shutting down...")


app = FastAPI(
    title="AIEffect API",
    description="AI Effect Backend - AI Voice Interaction Adapter",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(config.router)
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


@app.get("/api/health", response_model=BaseResponse)
async def health_check():
    services_status = {}
    overall_status = "healthy"
    
    try:
        db = get_db()
        await db.fetchone("SELECT 1")
        services_status["api"] = "ok"
        services_status["database"] = "ok"
    except Exception as e:
        get_logger(__name__).error(f"Database health check failed: {e}")
        services_status["api"] = "error"
        services_status["database"] = "error"
        overall_status = "unhealthy"
    
    try:
        proxy_service = get_proxy_service()
        proxy_status = proxy_service.get_status()
        services_status["proxy"] = "ok" if proxy_status.get("running") else "stopped"
    except Exception as e:
        get_logger(__name__).error(f"Proxy health check failed: {e}")
        services_status["proxy"] = "error"
    
    try:
        tts_service = get_tts_service()
        services_status["tts"] = "ok"
    except Exception as e:
        get_logger(__name__).error(f"TTS health check failed: {e}")
        services_status["tts"] = "error"
    
    try:
        db = get_db()
        await db.fetchone("SELECT 1 FROM character_memories LIMIT 1")
        services_status["memory"] = "ok"
    except Exception as e:
        get_logger(__name__).error(f"Memory health check failed: {e}")
        services_status["memory"] = "error"
    
    response_data = {
        "status": overall_status,
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "services": services_status
    }
    
    if overall_status == "healthy":
        return BaseResponse(data=response_data)
    else:
        return BaseResponse(
            code=503,
            message="Service unhealthy",
            data=response_data
        )


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


if __name__ == "__main__":
    import uvicorn
    config_manager = get_config_manager()
    port = config_manager.config.ports.api
    host = "0.0.0.0" if config_manager.config.lan_enabled else "127.0.0.1"
    uvicorn.run(
        "src.main:app",
        host=host,
        port=port,
        reload=True,
    )
