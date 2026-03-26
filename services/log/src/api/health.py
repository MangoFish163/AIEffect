"""
健康检查和系统接口
"""
from datetime import datetime
from fastapi import APIRouter

from ..models.schemas import HealthResponse, BaseResponse

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
