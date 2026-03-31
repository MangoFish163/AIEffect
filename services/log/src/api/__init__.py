"""
日志服务 API 模块
"""
try:
    from . import logs, alerts, health
except ImportError:
    import logs, alerts, health

__all__ = ["logs", "alerts", "health"]
