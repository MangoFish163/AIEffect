"""
健康检查和系统接口
"""
from datetime import datetime
from fastapi import APIRouter, Request
import sys

try:
    from ..models.schemas import HealthResponse, BaseResponse
except ImportError:
    from models.schemas import HealthResponse, BaseResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=BaseResponse)
async def health_check():
    """健康检查"""
    return BaseResponse(data={
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "services": {
            "database": "ok",
            "ingest": "ok",
            "stream": "ok"
        }
    })


@router.post("/shutdown")
async def shutdown(request: Request):
    """优雅关闭服务"""
    import asyncio
    import logging
    import sys

    logger = logging.getLogger(__name__)
    logger.info("Shutdown requested, stopping server...")

    async def do_shutdown():
        # 给响应一些时间返回
        await asyncio.sleep(0.5)
        # 尝试通过 server 实例优雅关闭
        try:
            from ..main import get_server
            server = get_server()
            if server and hasattr(server, 'should_exit'):
                server.should_exit = True
                logger.info("Server should_exit set to True")
                return
        except Exception:
            pass
        
        # 备选方案：使用 os._exit 避免异常堆栈
        import os
        os._exit(0)

    # 启动关闭任务
    asyncio.create_task(do_shutdown())

    return {"status": "shutting_down", "message": "Service is shutting down gracefully"}


@router.get("/metrics")
async def get_metrics():
    """Prometheus 指标（简化实现）"""
    metrics = """
# HELP logs_ingested_total Total number of logs ingested
# TYPE logs_ingested_total counter
logs_ingested_total 0

# HELP logs_ingest_rate Logs ingest rate per second
# TYPE logs_ingest_rate gauge
logs_ingest_rate 0

# HELP sse_subscribers_current Current number of SSE subscribers
# TYPE sse_subscribers_current gauge
sse_subscribers_current 0
"""
    return metrics
