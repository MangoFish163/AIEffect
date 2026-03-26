"""
日志服务数据库管理
"""
import os
import json
import aiosqlite
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

DATABASE_DIR = Path("./data")
DATABASE_FILE = DATABASE_DIR / "log_service.db"
ARCHIVE_DIR = DATABASE_DIR / "log_archives"


class DatabaseManager:
    """数据库管理器"""
    
    def __init__(self):
        self.db: Optional[aiosqlite.Connection] = None
        self._ensure_dirs()
        
    def _ensure_dirs(self):
        """确保目录存在"""
        DATABASE_DIR.mkdir(parents=True, exist_ok=True)
        ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
        
    async def init(self):
        """初始化数据库"""
        self.db = await aiosqlite.connect(DATABASE_FILE)
        self.db.row_factory = aiosqlite.Row
        await self._init_tables()
        
    async def close(self):
        """关闭数据库连接"""
        if self.db:
            await self.db.close()
            
    async def _init_tables(self):
        """初始化表结构"""
        # 启用外键约束
        await self.db.execute("PRAGMA foreign_keys = ON")
        # 启用 WAL 模式
        await self.db.execute("PRAGMA journal_mode = WAL")
        # 设置同步模式
        await self.db.execute("PRAGMA synchronous = NORMAL")
        # 设置缓存大小
        await self.db.execute("PRAGMA cache_size = -64000")
        
        # 创建统计表
        await self._create_stats_tables()
        # 创建告警表
        await self._create_alert_tables()
        # 创建归档记录表
        await self._create_archive_table()
        # 创建订阅会话表
        await self._create_subscriber_table()
        # 创建当前月的日志表
        await self._create_current_month_log_table()
        # 插入默认告警规则
        await self._insert_default_alert_rules()
        
        await self.db.commit()
        
    async def _create_stats_tables(self):
        """创建统计表"""
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS log_stats_hourly (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hour DATETIME NOT NULL,
                level VARCHAR(10) NOT NULL,
                module VARCHAR(100),
                count INTEGER DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                avg_message_length REAL,
                UNIQUE(hour, level, module)
            )
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_stats_hourly_time ON log_stats_hourly(hour DESC)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_stats_hourly_level ON log_stats_hourly(level)
        """)
        
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS log_stats_daily (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                level VARCHAR(10) NOT NULL,
                module VARCHAR(100),
                count INTEGER DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                UNIQUE(date, level, module)
            )
        """)
        
    async def _create_alert_tables(self):
        """创建告警表"""
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS alert_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                enabled BOOLEAN DEFAULT 1,
                level_min VARCHAR(10),
                module_pattern VARCHAR(100),
                message_pattern VARCHAR(255),
                condition_type VARCHAR(20) NOT NULL,
                threshold_count INTEGER,
                time_window INTEGER,
                notify_type VARCHAR(20),
                notify_config TEXT,
                cooldown_seconds INTEGER DEFAULT 300,
                last_triggered_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled)
        """)
        
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS alert_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id INTEGER NOT NULL,
                triggered_at DATETIME NOT NULL,
                resolved_at DATETIME,
                severity VARCHAR(10),
                message TEXT,
                context TEXT,
                notified BOOLEAN DEFAULT 0,
                FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
            )
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id)
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_alert_history_triggered ON alert_history(triggered_at DESC)
        """)
        
    async def _create_archive_table(self):
        """创建归档记录表"""
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS log_archives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                archive_name VARCHAR(50) NOT NULL,
                table_name VARCHAR(20) NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                record_count INTEGER,
                file_size INTEGER,
                file_path VARCHAR(255),
                compressed BOOLEAN DEFAULT 1,
                archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_archives_time ON log_archives(start_time, end_time)
        """)
        
    async def _create_subscriber_table(self):
        """创建订阅会话表"""
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS subscriber_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id VARCHAR(32) NOT NULL UNIQUE,
                client_ip VARCHAR(45),
                filter_level VARCHAR(10),
                filter_module VARCHAR(100),
                connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_ping_at DATETIME,
                disconnected_at DATETIME
            )
        """)
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_subscribers_session ON subscriber_sessions(session_id)
        """)
        
    async def _create_current_month_log_table(self):
        """创建当前月的日志表"""
        table_name = self._get_current_log_table_name()
        await self._create_log_table(table_name)
        
    def _get_current_log_table_name(self) -> str:
        """获取当前月的日志表名"""
        now = datetime.now()
        return f"logs_{now.year}_{now.month:02d}"
        
    async def _create_log_table(self, table_name: str):
        """创建日志表"""
        await self.db.execute(f"""
            CREATE TABLE IF NOT EXISTS {table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME NOT NULL,
                level VARCHAR(10) NOT NULL,
                module VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                source_file VARCHAR(255),
                source_line INTEGER,
                function_name VARCHAR(100),
                process_id INTEGER,
                thread_id INTEGER,
                trace_id VARCHAR(32),
                span_id VARCHAR(16),
                parent_span_id VARCHAR(16),
                exception_type VARCHAR(100),
                exception_message TEXT,
                exception_traceback TEXT,
                metadata TEXT,
                ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 创建索引
        await self.db.execute(f"""
            CREATE INDEX IF NOT EXISTS idx_{table_name}_time ON {table_name}(timestamp DESC)
        """)
        await self.db.execute(f"""
            CREATE INDEX IF NOT EXISTS idx_{table_name}_level ON {table_name}(level)
        """)
        await self.db.execute(f"""
            CREATE INDEX IF NOT EXISTS idx_{table_name}_module ON {table_name}(module)
        """)
        await self.db.execute(f"""
            CREATE INDEX IF NOT EXISTS idx_{table_name}_time_level ON {table_name}(timestamp, level)
        """)
        await self.db.execute(f"""
            CREATE INDEX IF NOT EXISTS idx_{table_name}_time_module ON {table_name}(timestamp, module)
        """)
        
        # 创建 FTS5 虚拟表
        await self.db.execute(f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS {table_name}_fts USING fts5(
                message,
                module,
                exception_message,
                content='{table_name}',
                content_rowid='id'
            )
        """)
        
        # 创建触发器
        await self.db.execute(f"""
            CREATE TRIGGER IF NOT EXISTS tr_{table_name}_fts_insert AFTER INSERT ON {table_name}
            BEGIN
                INSERT INTO {table_name}_fts(rowid, message, module, exception_message)
                VALUES (NEW.id, NEW.message, NEW.module, NEW.exception_message);
            END
        """)
        await self.db.execute(f"""
            CREATE TRIGGER IF NOT EXISTS tr_{table_name}_fts_delete AFTER DELETE ON {table_name}
            BEGIN
                INSERT INTO {table_name}_fts({table_name}_fts, rowid, message, module, exception_message)
                VALUES ('delete', OLD.id, OLD.message, OLD.module, OLD.exception_message);
            END
        """)
        
    async def _insert_default_alert_rules(self):
        """插入默认告警规则"""
        cursor = await self.db.execute("SELECT COUNT(*) FROM alert_rules")
        row = await cursor.fetchone()
        if row[0] == 0:
            await self.db.execute("""
                INSERT INTO alert_rules (name, description, level_min, condition_type, threshold_count, time_window, notify_type, notify_config)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "高频错误告警",
                "5分钟内出现10次以上ERROR级别日志",
                "ERROR",
                "threshold",
                10,
                300,
                "sse",
                json.dumps({"channels": ["admin"]})
            ))
            await self.db.execute("""
                INSERT INTO alert_rules (name, description, level_min, condition_type, threshold_count, time_window, notify_type, notify_config)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "系统异常告警",
                "出现CRITICAL级别日志立即告警",
                "CRITICAL",
                "threshold",
                1,
                60,
                "sse",
                json.dumps({"channels": ["admin", "webhook"]})
            ))
            
    async def get_log_table_name(self, timestamp: Optional[datetime] = None) -> str:
        """获取指定时间的日志表名"""
        if timestamp is None:
            timestamp = datetime.now()
        return f"logs_{timestamp.year}_{timestamp.month:02d}"
        
    async def ensure_log_table_exists(self, timestamp: Optional[datetime] = None):
        """确保日志表存在"""
        table_name = await self.get_log_table_name(timestamp)
        await self._create_log_table(table_name)
        return table_name
        
    async def insert_logs(self, logs: List[Dict[str, Any]]) -> int:
        """批量插入日志"""
        if not logs:
            return 0
            
        count = 0
        for log in logs:
            table_name = await self.ensure_log_table_exists(log.get('timestamp'))
            
            await self.db.execute(f"""
                INSERT INTO {table_name} 
                (timestamp, level, module, message, source_file, source_line, function_name,
                 process_id, thread_id, trace_id, span_id, parent_span_id,
                 exception_type, exception_message, exception_traceback, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                log.get('timestamp'),
                log.get('level'),
                log.get('module'),
                log.get('message'),
                log.get('source_file'),
                log.get('source_line'),
                log.get('function_name'),
                log.get('process_id'),
                log.get('thread_id'),
                log.get('trace_id'),
                log.get('span_id'),
                log.get('parent_span_id'),
                log.get('exception_type'),
                log.get('exception_message'),
                log.get('exception_traceback'),
                json.dumps(log.get('metadata')) if log.get('metadata') else None
            ))
            count += 1
            
        await self.db.commit()
        return count
        
    async def query_logs(self, 
                        level: Optional[str] = None,
                        module: Optional[str] = None,
                        search: Optional[str] = None,
                        start_time: Optional[datetime] = None,
                        end_time: Optional[datetime] = None,
                        page: int = 1,
                        page_size: int = 50) -> Dict[str, Any]:
        """查询日志"""
        # 确定需要查询的表
        tables = await self._get_tables_in_range(start_time, end_time)
        
        if not tables:
            return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}
            
        # 构建 UNION 查询
        union_parts = []
        params = []
        
        for table in tables:
            conditions = []
            
            if level:
                conditions.append("level = ?")
                params.append(level.upper())
            if module:
                conditions.append("module LIKE ?")
                params.append(f"%{module}%")
            if search:
                # 使用 FTS5 全文搜索
                conditions.append(f"id IN (SELECT rowid FROM {table}_fts WHERE {table}_fts MATCH ?)")
                params.append(search)
            if start_time:
                conditions.append("timestamp >= ?")
                params.append(start_time.isoformat())
            if end_time:
                conditions.append("timestamp <= ?")
                params.append(end_time.isoformat())
                
            where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
            
            union_parts.append(f"SELECT *, '{table}' as table_name FROM {table} {where_clause}")
            
        # 合并查询
        union_sql = " UNION ALL ".join(union_parts)
        count_sql = f"SELECT COUNT(*) FROM ({union_sql})"
        
        cursor = await self.db.execute(count_sql, params)
        row = await cursor.fetchone()
        total = row[0]
        
        # 分页查询
        offset = (page - 1) * page_size
        data_sql = f"{union_sql} ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([page_size, offset])
        
        cursor = await self.db.execute(data_sql, params)
        rows = await cursor.fetchall()
        
        items = []
        for row in rows:
            items.append({
                "id": f"{row['table_name']}_{row['id']}",
                "timestamp": row['timestamp'],
                "level": row['level'],
                "module": row['module'],
                "message": row['message'],
                "source_file": row['source_file'],
                "source_line": row['source_line'],
                "exception_type": row['exception_type'],
                "exception_traceback": row['exception_traceback'],
                "metadata": json.loads(row['metadata']) if row['metadata'] else None
            })
            
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
        
    async def _get_tables_in_range(self, start_time: Optional[datetime], end_time: Optional[datetime]) -> List[str]:
        """获取时间范围内的所有日志表"""
        tables = []
        
        # 获取所有存在的日志表
        cursor = await self.db.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name LIKE 'logs_%'
        """)
        rows = await cursor.fetchall()
        existing_tables = {row[0] for row in rows}
        
        # 如果没有时间范围，只返回当前月的表
        if not start_time and not end_time:
            current_table = self._get_current_log_table_name()
            if current_table in existing_tables:
                return [current_table]
            return []
            
        # 计算时间范围内的所有月份
        start = start_time or datetime.now() - timedelta(days=30)
        end = end_time or datetime.now()
        
        current = datetime(start.year, start.month, 1)
        while current <= end:
            table_name = f"logs_{current.year}_{current.month:02d}"
            if table_name in existing_tables:
                tables.append(table_name)
            # 移动到下个月
            if current.month == 12:
                current = datetime(current.year + 1, 1, 1)
            else:
                current = datetime(current.year, current.month + 1, 1)
                
        return tables
        
    async def get_stats(self) -> Dict[str, int]:
        """获取日志统计"""
        tables = await self._get_tables_in_range(None, None)

        if not tables:
            return {"total": 0, "error_count": 0, "warn_count": 0, "info_count": 0, "debug_count": 0}

        union_parts = [f"SELECT level FROM {table}" for table in tables]
        union_sql = " UNION ALL ".join(union_parts)

        cursor = await self.db.execute(f"""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) as error_count,
                SUM(CASE WHEN level = 'WARNING' THEN 1 ELSE 0 END) as warn_count,
                SUM(CASE WHEN level = 'INFO' THEN 1 ELSE 0 END) as info_count,
                SUM(CASE WHEN level = 'DEBUG' THEN 1 ELSE 0 END) as debug_count
            FROM ({union_sql})
        """)

        row = await cursor.fetchone()
        return {
            "total": row[0] or 0,
            "error_count": row[1] or 0,
            "warn_count": row[2] or 0,
            "info_count": row[3] or 0,
            "debug_count": row[4] or 0
        }

    async def aggregate_logs(
        self,
        group_by: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        level: Optional[str] = None,
        module: Optional[str] = None
    ) -> Dict[str, Any]:
        """聚合分析日志

        Args:
            group_by: 分组方式 (level, module, hour, day)
            start_time: 开始时间
            end_time: 结束时间
            level: 过滤级别
            module: 过滤模块

        Returns:
            聚合结果
        """
        tables = await self._get_tables_in_range(start_time, end_time)

        if not tables:
            return {"group_by": group_by, "items": [], "total_count": 0}

        # 构建 WHERE 条件
        conditions = []
        params = []

        if level:
            conditions.append("level = ?")
            params.append(level.upper())
        if module:
            conditions.append("module LIKE ?")
            params.append(f"%{module}%")
        if start_time:
            conditions.append("timestamp >= ?")
            params.append(start_time.isoformat())
        if end_time:
            conditions.append("timestamp <= ?")
            params.append(end_time.isoformat())

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        # 根据分组方式构建查询
        if group_by == "level":
            group_sql = "level"
            label_field = "level"
        elif group_by == "module":
            group_sql = "module"
            label_field = "module"
        elif group_by == "hour":
            group_sql = "strftime('%Y-%m-%d %H:00:00', timestamp)"
            label_field = "hour"
        elif group_by == "day":
            group_sql = "strftime('%Y-%m-%d', timestamp)"
            label_field = "day"
        else:
            raise ValueError(f"Unsupported group_by: {group_by}")

        # 构建 UNION 查询
        union_parts = []
        for table in tables:
            union_parts.append(f"SELECT level, module, timestamp FROM {table} {where_clause}")

        union_sql = " UNION ALL ".join(union_parts)

        # 聚合查询
        query = f"""
            SELECT
                {group_sql} as {label_field},
                COUNT(*) as count,
                SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) as error_count,
                SUM(CASE WHEN level = 'WARNING' THEN 1 ELSE 0 END) as warn_count,
                SUM(CASE WHEN level = 'INFO' THEN 1 ELSE 0 END) as info_count,
                SUM(CASE WHEN level = 'DEBUG' THEN 1 ELSE 0 END) as debug_count
            FROM ({union_sql})
            GROUP BY {group_sql}
            ORDER BY count DESC
        """

        cursor = await self.db.execute(query, params)
        rows = await cursor.fetchall()

        items = []
        total_count = 0
        for row in rows:
            items.append({
                label_field: row[0],
                "count": row[1],
                "error_count": row[2] or 0,
                "warn_count": row[3] or 0,
                "info_count": row[4] or 0,
                "debug_count": row[5] or 0
            })
            total_count += row[1]

        return {
            "group_by": group_by,
            "items": items,
            "total_count": total_count,
            "start_time": start_time.isoformat() if start_time else None,
            "end_time": end_time.isoformat() if end_time else None
        }

    async def get_hourly_stats(
        self,
        hours: int = 24,
        level: Optional[str] = None,
        module: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取小时级统计

        Args:
            hours: 查询最近多少小时
            level: 过滤级别
            module: 过滤模块

        Returns:
            每小时统计列表
        """
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)

        result = await self.aggregate_logs(
            group_by="hour",
            start_time=start_time,
            end_time=end_time,
            level=level,
            module=module
        )

        # 填充缺失的小时
        items_map = {item["hour"]: item for item in result["items"]}
        filled_items = []

        current = start_time.replace(minute=0, second=0, microsecond=0)
        while current <= end_time:
            hour_str = current.strftime("%Y-%m-%d %H:00:00")
            if hour_str in items_map:
                filled_items.append(items_map[hour_str])
            else:
                filled_items.append({
                    "hour": hour_str,
                    "count": 0,
                    "error_count": 0,
                    "warn_count": 0,
                    "info_count": 0,
                    "debug_count": 0
                })
            current += timedelta(hours=1)

        return filled_items

    async def get_daily_stats(
        self,
        days: int = 7,
        level: Optional[str] = None,
        module: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取日级统计

        Args:
            days: 查询最近多少天
            level: 过滤级别
            module: 过滤模块

        Returns:
            每日统计列表
        """
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days)

        result = await self.aggregate_logs(
            group_by="day",
            start_time=start_time,
            end_time=end_time,
            level=level,
            module=module
        )

        # 填充缺失的天
        items_map = {item["day"]: item for item in result["items"]}
        filled_items = []

        current = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
        while current <= end_time:
            day_str = current.strftime("%Y-%m-%d")
            if day_str in items_map:
                filled_items.append(items_map[day_str])
            else:
                filled_items.append({
                    "day": day_str,
                    "count": 0,
                    "error_count": 0,
                    "warn_count": 0,
                    "info_count": 0,
                    "debug_count": 0
                })
            current += timedelta(days=1)

        return filled_items

    async def update_stats_hourly(self) -> int:
        """更新小时级统计表

        从日志表聚合数据并更新统计表。
        返回更新的记录数。
        """
        # 获取需要统计的小时（最近24小时）
        now = datetime.now()
        current_hour = now.replace(minute=0, second=0, microsecond=0)

        tables = await self._get_tables_in_range(current_hour - timedelta(hours=24), now)
        if not tables:
            return 0

        updated_count = 0

        for hour_offset in range(24):
            hour = current_hour - timedelta(hours=hour_offset)
            hour_str = hour.strftime("%Y-%m-%d %H:00:00")

            # 构建 UNION 查询
            union_parts = []
            for table in tables:
                union_parts.append(f"""
                    SELECT level, module FROM {table}
                    WHERE timestamp >= ? AND timestamp < ?
                """)
            union_sql = " UNION ALL ".join(union_parts)

            next_hour = hour + timedelta(hours=1)
            params = [hour.isoformat(), next_hour.isoformat()] * len(tables)

            # 按级别和模块聚合
            query = f"""
                SELECT
                    level,
                    module,
                    COUNT(*) as count,
                    SUM(CASE WHEN level IN ('ERROR', 'CRITICAL') THEN 1 ELSE 0 END) as error_count,
                    AVG(LENGTH(message)) as avg_message_length
                FROM ({union_sql})
                GROUP BY level, module
            """

            try:
                cursor = await self.db.execute(query, params)
                rows = await cursor.fetchall()

                # 插入或更新统计表
                for row in rows:
                    await self.db.execute("""
                        INSERT INTO log_stats_hourly
                        (hour, level, module, count, error_count, avg_message_length)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(hour, level, module) DO UPDATE SET
                        count = excluded.count,
                        error_count = excluded.error_count,
                        avg_message_length = excluded.avg_message_length
                    """, (hour_str, row[0], row[1], row[2], row[3], row[4]))
                    updated_count += 1

            except Exception:
                # 某些表可能不存在，忽略错误
                pass

        await self.db.commit()
        return updated_count

    async def get_module_stats(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取模块统计

        Args:
            limit: 返回前N个模块

        Returns:
            模块统计列表
        """
        tables = await self._get_tables_in_range(None, None)

        if not tables:
            return []

        union_parts = [f"SELECT module, level FROM {table}" for table in tables]
        union_sql = " UNION ALL ".join(union_parts)

        query = f"""
            SELECT
                module,
                COUNT(*) as total_count,
                SUM(CASE WHEN level = 'ERROR' THEN 1 ELSE 0 END) as error_count,
                SUM(CASE WHEN level = 'WARNING' THEN 1 ELSE 0 END) as warn_count,
                SUM(CASE WHEN level = 'INFO' THEN 1 ELSE 0 END) as info_count,
                SUM(CASE WHEN level = 'DEBUG' THEN 1 ELSE 0 END) as debug_count,
                MAX(timestamp) as last_log_time
            FROM ({union_sql})
            GROUP BY module
            ORDER BY total_count DESC
            LIMIT ?
        """

        cursor = await self.db.execute(query, [limit])
        rows = await cursor.fetchall()

        return [
            {
                "module": row[0],
                "total_count": row[1],
                "error_count": row[2] or 0,
                "warn_count": row[3] or 0,
                "info_count": row[4] or 0,
                "debug_count": row[5] or 0,
                "last_log_time": row[6]
            }
            for row in rows
        ]

    async def archive_table(
        self,
        table_name: str,
        archive_dir: Path = None
    ) -> Dict[str, Any]:
        """归档指定月份的日志表

        Args:
            table_name: 表名 (如: logs_2024_01)
            archive_dir: 归档目录

        Returns:
            归档结果信息
        """
        if archive_dir is None:
            archive_dir = ARCHIVE_DIR
        archive_dir.mkdir(parents=True, exist_ok=True)

        # 检查表是否存在
        cursor = await self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
            (table_name,)
        )
        if not await cursor.fetchone():
            raise ValueError(f"Table {table_name} does not exist")

        # 获取表的时间范围
        cursor = await self.db.execute(
            f"SELECT MIN(timestamp), MAX(timestamp), COUNT(*) FROM {table_name}"
        )
        row = await cursor.fetchone()
        start_time, end_time, record_count = row[0], row[1], row[2]

        if record_count == 0:
            return {
                "table_name": table_name,
                "status": "skipped",
                "reason": "empty table"
            }

        # 导出数据到 JSONL
        archive_name = f"{table_name}.jsonl.gz"
        archive_path = archive_dir / archive_name

        import gzip
        exported_count = 0

        cursor = await self.db.execute(f"SELECT * FROM {table_name}")
        rows = await cursor.fetchall()

        with gzip.open(archive_path, 'wt', encoding='utf-8') as f:
            for row in rows:
                log_entry = {
                    "id": row['id'],
                    "timestamp": row['timestamp'],
                    "level": row['level'],
                    "module": row['module'],
                    "message": row['message'],
                    "source_file": row['source_file'],
                    "source_line": row['source_line'],
                    "function_name": row['function_name'],
                    "process_id": row['process_id'],
                    "thread_id": row['thread_id'],
                    "trace_id": row['trace_id'],
                    "span_id": row['span_id'],
                    "parent_span_id": row['parent_span_id'],
                    "exception_type": row['exception_type'],
                    "exception_message": row['exception_message'],
                    "exception_traceback": row['exception_traceback'],
                    "metadata": json.loads(row['metadata']) if row['metadata'] else None,
                    "ingested_at": row['ingested_at']
                }
                f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')
                exported_count += 1

        # 获取文件大小
        file_size = archive_path.stat().st_size

        # 记录归档信息
        await self.db.execute("""
            INSERT INTO log_archives
            (archive_name, table_name, start_time, end_time, record_count, file_size, file_path, compressed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            archive_name,
            table_name,
            start_time,
            end_time,
            exported_count,
            file_size,
            str(archive_path),
            True
        ))

        # 删除原表和 FTS 表
        await self.db.execute(f"DROP TABLE IF EXISTS {table_name}")
        await self.db.execute(f"DROP TABLE IF EXISTS {table_name}_fts")

        await self.db.commit()

        return {
            "table_name": table_name,
            "status": "archived",
            "archive_name": archive_name,
            "archive_path": str(archive_path),
            "record_count": exported_count,
            "file_size": file_size,
            "start_time": start_time,
            "end_time": end_time
        }

    async def get_archives(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """获取归档列表"""
        conditions = []
        params = []

        if start_time:
            conditions.append("end_time >= ?")
            params.append(start_time.isoformat())
        if end_time:
            conditions.append("start_time <= ?")
            params.append(end_time.isoformat())

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        cursor = await self.db.execute(f"""
            SELECT * FROM log_archives
            {where_clause}
            ORDER BY archived_at DESC
        """, params)

        rows = await cursor.fetchall()

        return [
            {
                "id": row['id'],
                "archive_name": row['archive_name'],
                "table_name": row['table_name'],
                "start_time": row['start_time'],
                "end_time": row['end_time'],
                "record_count": row['record_count'],
                "file_size": row['file_size'],
                "file_path": row['file_path'],
                "compressed": bool(row['compressed']),
                "archived_at": row['archived_at']
            }
            for row in rows
        ]

    async def restore_archive(
        self,
        archive_id: int,
        target_table: str = None
    ) -> Dict[str, Any]:
        """从归档恢复数据

        Args:
            archive_id: 归档记录ID
            target_table: 目标表名（默认使用原表名）

        Returns:
            恢复结果信息
        """
        cursor = await self.db.execute(
            "SELECT * FROM log_archives WHERE id = ?",
            (archive_id,)
        )
        row = await cursor.fetchone()

        if not row:
            raise ValueError(f"Archive {archive_id} not found")

        archive_path = Path(row['file_path'])
        if not archive_path.exists():
            raise ValueError(f"Archive file not found: {archive_path}")

        table_name = target_table or row['table_name']

        # 创建表
        await self._create_log_table(table_name)

        import gzip
        restored_count = 0

        with gzip.open(archive_path, 'rt', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue

                log_entry = json.loads(line)

                await self.db.execute(f"""
                    INSERT INTO {table_name}
                    (timestamp, level, module, message, source_file, source_line, function_name,
                     process_id, thread_id, trace_id, span_id, parent_span_id,
                     exception_type, exception_message, exception_traceback, metadata, ingested_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    log_entry.get('timestamp'),
                    log_entry.get('level'),
                    log_entry.get('module'),
                    log_entry.get('message'),
                    log_entry.get('source_file'),
                    log_entry.get('source_line'),
                    log_entry.get('function_name'),
                    log_entry.get('process_id'),
                    log_entry.get('thread_id'),
                    log_entry.get('trace_id'),
                    log_entry.get('span_id'),
                    log_entry.get('parent_span_id'),
                    log_entry.get('exception_type'),
                    log_entry.get('exception_message'),
                    log_entry.get('exception_traceback'),
                    json.dumps(log_entry.get('metadata')) if log_entry.get('metadata') else None,
                    log_entry.get('ingested_at')
                ))
                restored_count += 1

        await self.db.commit()

        return {
            "archive_id": archive_id,
            "table_name": table_name,
            "restored_count": restored_count,
            "source_file": str(archive_path)
        }

    async def auto_archive_old_logs(
        self,
        months: int = 3
    ) -> List[Dict[str, Any]]:
        """自动归档旧日志

        Args:
            months: 归档多少个月之前的日志

        Returns:
            归档结果列表
        """
        cutoff_date = datetime.now() - timedelta(days=30 * months)
        cutoff_table = f"logs_{cutoff_date.year}_{cutoff_date.month:02d}"

        # 获取所有日志表
        cursor = await self.db.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name LIKE 'logs_%'
            ORDER BY name
        """)
        rows = await cursor.fetchall()

        results = []

        for row in rows:
            table_name = row[0]
            # 跳过当前月和最近几个月的表
            if table_name >= cutoff_table:
                continue

            try:
                result = await self.archive_table(table_name)
                results.append(result)
            except Exception as e:
                results.append({
                    "table_name": table_name,
                    "status": "failed",
                    "error": str(e)
                })

        return results


# 全局数据库管理器实例
_db_manager: Optional[DatabaseManager] = None


async def get_db() -> DatabaseManager:
    """获取数据库管理器实例"""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
        await _db_manager.init()
    return _db_manager
