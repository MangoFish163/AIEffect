"""
日志服务数据模型
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class LogEntry(BaseModel):
    """日志条目模型"""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    level: str = Field(..., description="日志级别: DEBUG, INFO, WARNING, ERROR, CRITICAL")
    module: str = Field(..., description="模块名称")
    message: str = Field(..., description="日志消息")
    
    # 源代码位置
    source_file: Optional[str] = None
    source_line: Optional[int] = None
    function_name: Optional[str] = None
    
    # 进程信息
    process_id: Optional[int] = None
    thread_id: Optional[int] = None
    
    # 分布式追踪
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    parent_span_id: Optional[str] = None
    
    # 异常信息
    exception_type: Optional[str] = None
    exception_message: Optional[str] = None
    exception_traceback: Optional[str] = None
    
    # 元数据
    metadata: Optional[Dict[str, Any]] = None


class LogBatch(BaseModel):
    """日志批次模型"""
    logs: List[LogEntry]
    source: str = Field(default="unknown", description="日志来源")
    batch_id: Optional[str] = None


class LogQueryParams(BaseModel):
    """日志查询参数"""
    level: Optional[str] = None
    module: Optional[str] = None
    search: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=200)


class LogResponse(BaseModel):
    """日志查询响应"""
    id: str
    timestamp: datetime
    level: str
    module: str
    message: str
    source_file: Optional[str] = None
    source_line: Optional[int] = None
    exception_type: Optional[str] = None
    exception_traceback: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class LogListResponse(BaseModel):
    """日志列表响应"""
    items: List[LogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class LogStats(BaseModel):
    """日志统计"""
    total: int
    error_count: int
    warn_count: int
    info_count: int
    debug_count: int


class LogStatsHourly(BaseModel):
    """小时级统计"""
    hour: datetime
    level: str
    module: Optional[str]
    count: int
    error_count: int


class IngestResponse(BaseModel):
    """日志接收响应"""
    received: int
    ingested: int
    failed: int
    batch_id: Optional[str] = None


class AlertRule(BaseModel):
    """告警规则"""
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    enabled: bool = True
    level_min: Optional[str] = None
    module_pattern: Optional[str] = None
    message_pattern: Optional[str] = None
    condition_type: str = Field(..., description="threshold, rate, pattern")
    threshold_count: Optional[int] = None
    time_window: Optional[int] = None
    notify_type: Optional[str] = None
    notify_config: Optional[Dict[str, Any]] = None
    cooldown_seconds: int = 300
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AlertHistory(BaseModel):
    """告警历史"""
    id: int
    rule_id: int
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    severity: str
    message: str
    context: Optional[Dict[str, Any]] = None
    notified: bool = False


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    timestamp: datetime
    version: str
    services: Dict[str, str]


class BaseResponse(BaseModel):
    """基础响应"""
    code: int = 200
    message: str = "success"
    data: Optional[Any] = None
