"""
AIEffect Log Service - 独立日志服务
"""
import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 支持相对导入和绝对导入
try:
    from .api import logs, alerts, health
    from .core.database import get_db, DatabaseManager
    from .services.log_streamer import get_streamer, LogStreamer
    from .services.alert_engine import get_alert_engine, AlertEngine
    from .services.log_cache import get_log_cache, LogCache
except ImportError:
    from api import logs, alerts, health
    from core.database import get_db, DatabaseManager
    from services.log_streamer import get_streamer, LogStreamer
    from services.alert_engine import get_alert_engine, AlertEngine
    from services.log_cache import get_log_cache, LogCache


# 全局服务实例
_db_manager: DatabaseManager = None
_streamer: LogStreamer = None
_alert_engine: AlertEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global _db_manager, _streamer, _alert_engine, _log_cache

    # 启动时初始化
    print("🚀 AIEffect Log Service starting...")

    # 初始化数据库
    try:
        _db_manager = await get_db()
        logging.info("Database initialized")
    except Exception as e:
        logging.error(f"Database initialization failed: {str(e)}")
        raise

    # 初始化日志缓存（最近200条）
    try:
        _log_cache = await get_log_cache(max_size=200)
        logging.info(f"Log cache initialized (max_size=200)")
    except Exception as e:
        logging.error(f"Log cache initialization failed: {str(e)}")
        raise

    # 初始化日志流服务
    try:
        _streamer = await get_streamer()
        logging.info("Log streamer started")
    except Exception as e:
        logging.error(f"Log streamer initialization failed: {str(e)}")
        raise

    # 初始化告警引擎
    try:
        _alert_engine = await get_alert_engine(_db_manager)
        await _alert_engine.start()
        logging.info("Alert engine started")
    except Exception as e:
        logging.error(f"Alert engine initialization failed: {str(e)}")
        raise

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


# 全局 server 实例，用于优雅关闭
_uvicorn_server = None

def get_server():
    """获取 uvicorn server 实例"""
    global _uvicorn_server
    return _uvicorn_server

if __name__ == "__main__":
    import uvicorn
    import logging
    
    # 配置访问日志过滤器，跳过健康检查端点
    class HealthCheckFilter(logging.Filter):
        def filter(self, record):
            # 过滤掉健康检查端点的访问日志
            if hasattr(record, 'args') and len(record.args) >= 3:
                path = str(record.args[2]) if len(record.args) > 2 else ""
                if path == "/health" or path.startswith("/health"):
                    return False
            return True
    
    # 获取 uvicorn 访问日志记录器并添加过滤器
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.addFilter(HealthCheckFilter())
    
    config = uvicorn.Config(
        "src.main:app",
        host="0.0.0.0",
        port=8505,
        reload=True
    )
    _uvicorn_server = uvicorn.Server(config)
    _uvicorn_server.run()
