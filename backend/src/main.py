from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .core.config import get_config_manager
from .core.logger import setup_logger, get_logger
from .core.port_manager import PortManager
from .models.schemas import (
    HealthResponse,
    ConfigResponse,
    UpdateConfigRequest,
    PortsResponse,
)
from .api import proxy, tts, subtitle, memory, logs


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logger()
    logger = get_logger(__name__)
    logger.info("AIEffect Backend starting...")
    config_manager = get_config_manager()
    logger.info(f"Config loaded. Ports: {config_manager.config.ports}")
    yield
    logger.info("AIEffect Backend shutting down...")


app = FastAPI(
    title="AIEffect API",
    description="AI Effect Backend - AI Voice Interaction Adapter",
    version="0.1.0",
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
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(proxy.router)
app.include_router(tts.router)
app.include_router(subtitle.router)
app.include_router(memory.router)
app.include_router(logs.router)


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    config_manager = get_config_manager()
    ports = config_manager.config.ports
    return {
        "status": "ok",
        "timestamp": datetime.now(),
        "version": "0.1.0",
        "ports": {
            "api": ports.api,
            "ollama_proxy": ports.ollama_proxy,
            "websocket": ports.websocket,
            "subtitle": ports.subtitle,
            "tts": ports.tts,
            "log": ports.log,
        }
    }


@app.get("/api/config", response_model=ConfigResponse)
async def get_config():
    try:
        config_manager = get_config_manager()
        config = config_manager.config
        return ConfigResponse(
            api=config.api.model_dump(),
            tts=config.tts.model_dump(),
            subtitle=config.subtitle.model_dump(),
            memory=config.memory.model_dump(),
            ports=config.ports.model_dump(),
            lan_enabled=config.lan_enabled,
        )
    except Exception as e:
        get_logger(__name__).error(f"Error getting config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/config", response_model=ConfigResponse)
async def update_config(request: UpdateConfigRequest):
    try:
        config_manager = get_config_manager()
        update_dict = {}
        if request.api is not None:
            update_dict["api"] = request.api
        if request.tts is not None:
            update_dict["tts"] = request.tts
        if request.subtitle is not None:
            update_dict["subtitle"] = request.subtitle
        if request.memory is not None:
            update_dict["memory"] = request.memory
        if request.lan_enabled is not None:
            update_dict["lan_enabled"] = request.lan_enabled
        config_manager.update_config(update_dict)
        config = config_manager.config
        return ConfigResponse(
            api=config.api.model_dump(),
            tts=config.tts.model_dump(),
            subtitle=config.subtitle.model_dump(),
            memory=config.memory.model_dump(),
            ports=config.ports.model_dump(),
            lan_enabled=config.lan_enabled,
        )
    except Exception as e:
        get_logger(__name__).error(f"Error updating config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ports", response_model=PortsResponse)
async def get_ports():
    try:
        config_manager = get_config_manager()
        ports = config_manager.config.ports
        return PortsResponse(
            api=ports.api,
            ollama_proxy=ports.ollama_proxy,
            websocket=ports.websocket,
            subtitle=ports.subtitle,
            tts=ports.tts,
            log=ports.log,
        )
    except Exception as e:
        get_logger(__name__).error(f"Error getting ports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    config_manager = get_config_manager()
    settings = config_manager.settings
    port = config_manager.config.ports.api
    host = "0.0.0.0" if config_manager.config.lan_enabled else "127.0.0.1"
    uvicorn.run(
        "src.main:app",
        host=host,
        port=port,
        reload=True,
    )
