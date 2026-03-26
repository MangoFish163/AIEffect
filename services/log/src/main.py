"""
AIEffect Log Service - 独立日志服务
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import logs, alerts, health
from .core.database import get_db, DatabaseManager
from .services.log_streamer import get_streamer, LogStreamer
from .services.alert_engine import get_alert_engine, AlertEngine


# 全局服务实例
_db_manager: DatabaseManager = None
_streamer: LogStreamer = None
_alert_engine: AlertEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global _db_manager, _streamer, _alert_engine

    # 启动时初始化
    print("🚀 AIEffect Log Service starting...")

    # 初始化数据库
    _db_manager = await get_db()
    print("✅ Database initialized")

    # 初始化日志流服务
    _streamer = await get_streamer()
    print("✅ Log streamer started")

    # 初始化告警引擎
    _alert_engine = await get_alert_engine(_db_manager)
    await _alert_engine.start()
    print("✅ Alert engine started")

    # 将告警事件广播到 SSE
    def on_alert(event):
        asyncio.create_task(_streamer.broadcast({
            "type": "alert",
            "severity": event.severity,
            "message": event.message,
            "rule_name": event.rule_name,
            "triggered_at": event.triggered_at.isoformat()
        }))

    _alert_engine.add_callback(on_alert)

    print(f"📝 Log Service ready at http://localhost:8505")

    yield

    # 关闭时清理
    print("🛑 AIEffect Log Service shutting down...")

    if _alert_engine:
        await _alert_engine.stop()
        print("✅ Alert engine stopped")

    if _streamer:
        await _streamer.stop()
        print("✅ Log streamer stopped")

    if _db_manager:
        await _db_manager.close()
        print("✅ Database closed")


# 创建 FastAPI 应用
app = FastAPI(
    title="AIEffect Log Service",
    description="独立日志收集与查询服务",
    version="1.0.0",
    lifespan=lifespan
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(logs.router)
app.include_router(alerts.router)
app.include_router(health.router)


@app.get("/")
async def root():
    """根路径"""
    return {
        "service": "AIEffect Log Service",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8505,
        reload=True
    )
