# AIEffect Log Service 项目结构文档

## 项目概述

Log Service 是 AIEffect 的独立日志收集和分析服务，负责：
- 日志收集和存储
- 日志查询和过滤
- 实时日志流（SSE）
- 日志统计和分析
- 日志导出

**注意**：此服务从根目录 `log_service/` 迁移而来，现为完全独立的微服务。

---

## 目录结构

```
services/log/
├── Dockerfile                  # Docker 镜像构建配置
├── PROJECT_STRUCTURE.md        # 本文档
├── README.md                   # 服务说明文档
├── pyproject.toml              # Poetry 依赖管理
├── requirements.txt            # pip 依赖（备选）
├── start.py                    # 服务启动脚本
└── src/
    └── log_service/
        ├── __init__.py         # 包初始化
        ├── main.py             # FastAPI 应用入口
        ├── api/                # API 路由层
        │   ├── __init__.py
        │   ├── alerts.py       # 告警规则管理
        │   ├── health.py       # 健康检查
        │   ├── logs.py         # 日志查询和导出
        │   └── stream.py       # SSE 实时日志流
        ├── core/               # 核心模块层
        │   ├── __init__.py
        │   ├── config.py       # 日志服务配置
        │   ├── database.py     # SQLite 数据库管理
        │   ├── log_collector.py # 日志收集器
        │   └── log_streamer.py # 日志流管理
        └── models/             # 数据模型层
            ├── __init__.py
            └── schemas.py      # Pydantic 数据模型
```

---

## 核心设计原则

### 1. 独立数据库

日志服务拥有独立的数据库，不与其他服务共享：

```python
# core/database.py
LOG_DB_PATH = Path("data/logs/logs.db")
```

### 2. 依赖共享包

使用 `shared_core` 的基础功能：

```python
# ✅ 正确：使用共享包
from shared_core import get_logger
from shared_core.schemas import BaseResponse

# ❌ 错误：日志服务不使用共享数据库
# from shared_core import get_db  # 日志服务有自己的数据库
```

### 3. 异步处理

所有日志操作都是异步的：

```python
async def ingest_logs(self, logs: List[LogEntry]) -> IngestResponse:
    async with self._lock:
        await self._batch_insert(logs)
```

---

## 文件功能详解

### main.py

**FastAPI 应用入口**

- 创建 FastAPI 应用实例
- 注册所有 API 路由
- 应用生命周期管理
- 数据库初始化
- 日志收集器和流管理器启动

### api/logs.py

**日志查询 API**

- `GET /logs` - 分页查询日志
- `GET /logs/stats` - 日志统计
- `DELETE /logs` - 清空日志
- `GET /export` - 导出日志（JSON/CSV/TXT）

### api/stream.py

**实时日志流 API**

- `GET /stream` - SSE 实时日志流
- `GET /stream/modules` - 获取活跃模块列表
- 支持级别过滤和模块过滤

### api/alerts.py

**告警规则管理**

- `GET /alerts/rules` - 获取告警规则
- `POST /alerts/rules` - 创建告警规则
- `PUT /alerts/rules/{id}` - 更新告警规则
- `DELETE /alerts/rules/{id}` - 删除告警规则

### core/database.py

**日志数据库管理**

- 独立 SQLite 数据库（`logs.db`）
- 按月分表（`logs_2024_01`, `logs_2024_02`...）
- FTS5 全文搜索支持
- 自动归档和清理

### core/log_collector.py

**日志收集器**

- 批量接收日志（`/ingest` 端点）
- 异步写入数据库
- 失败重试机制
- 内存缓冲优化

### core/log_streamer.py

**日志流管理器**

- SSE 连接管理
- 实时日志推送
- 过滤和订阅管理
- 心跳保持

---

## 技术栈

| 组件 | 用途 | 版本 |
|------|------|------|
| FastAPI | Web 框架 | ^0.115.0 |
| aiosqlite | 异步 SQLite | ^0.20.0 |
| Pydantic | 数据验证 | ^2.10.0 |
| SSE-Starlette | SSE 支持 | ^2.1.0 |
| shared_core | 共享核心（仅 logger）| 本地路径 |

---

## 端口配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| Log Service | 8505 | 本服务端口 |
| API Gateway | 8500 | 代理日志请求 |

---

## 数据库设计

### 表结构

```sql
-- 按月分表
CREATE TABLE logs_2024_01 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp REAL NOT NULL,
    level TEXT NOT NULL,
    module TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata TEXT
);

-- 全文搜索虚拟表
CREATE VIRTUAL TABLE logs_fts USING fts5(
    message,
    content='logs_2024_01',
    content_rowid='id'
);
```

### 数据保留策略

- **热数据**：最近 3 个月，主表存储
- **温数据**：3-12 个月，归档表存储
- **冷数据**：超过 12 个月，导出文件存储

---

## API 端点

### 日志收集

| 端点 | 方法 | 说明 |
|------|------|------|
| `/ingest` | POST | 批量接收日志 |

### 日志查询

| 端点 | 方法 | 说明 |
|------|------|------|
| `/logs` | GET | 分页查询 |
| `/logs/stats` | GET | 统计信息 |
| `/logs` | DELETE | 清空日志 |

### 实时流

| 端点 | 方法 | 说明 |
|------|------|------|
| `/stream` | GET | SSE 实时流 |
| `/stream/modules` | GET | 活跃模块 |

### 导出

| 端点 | 方法 | 说明 |
|------|------|------|
| `/export` | GET | 导出日志 |

---

## 与原 log_service/ 的差异

| 项目 | 原位置 | 新位置 |
|------|--------|--------|
| 位置 | `log_service/` | `services/log/` |
| 架构 | 独立目录 | 统一 services/ 管理 |
| 依赖 | requirements.txt | Poetry 管理 |
| 共享 | 无 | 使用 shared_core.logger |

---

## 开发规范

### 1. 新增 API

```python
@router.post("/new-endpoint", response_model=BaseResponse)
async def new_endpoint(request: NewRequest):
    logger = get_logger(__name__)
    logger.info(f"New endpoint called: {request}")
    # 业务逻辑
    return BaseResponse(data=result)
```

### 2. 数据库操作

```python
# 使用日志服务自己的数据库
db = get_log_db()

# 异步操作
async with db.connection() as conn:
    await conn.execute("INSERT INTO logs ...")
```

### 3. 日志上报

其他服务通过 HTTP 上报日志：

```python
# 其他服务中的 RemoteLogHandler
async def _send_logs(self, logs: List[Dict]):
    async with aiohttp.ClientSession() as session:
        await session.post(
            "http://localhost:8505/ingest",
            json={"logs": logs}
        )
```

---

## 性能优化

### 1. 批量写入

- 默认批量大小：100 条
- 最大等待时间：5 秒
- 内存缓冲：1000 条

### 2. 查询优化

- 按时间范围查询优先
- 全文搜索使用 FTS5
- 分页查询限制最大 200 条

### 3. 归档策略

- 每月自动创建新表
- 旧表自动压缩
- 定期清理过期数据

---

## 相关文档

- [架构重构迁移设计](../../架构重构迁移设计.md)
- [日志服务设计](../../开发规范要求/日志服务设计.md)
- [服务总览](../README.md)
- [共享包文档](../../shared/python/README.md)
