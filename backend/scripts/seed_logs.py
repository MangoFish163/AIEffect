#!/usr/bin/env python3
"""
生成演示日志数据脚本
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from core.database import get_db
from core.logger import setup_logger

setup_logger()

LOG_MODULES = [
    'app.lib.api',
    'app.lib.config',
    'app.lib.database',
    'app.lib.logger',
    'app.lib.memory',
    'app.lib.tts',
    'app.lib.subtitle',
    'app.lib.proxy',
    'app.lib.agents',
    'app.lib.characters',
]

LOG_MESSAGES = {
    'INFO': [
        'Application started successfully',
        'Database connection established',
        'Configuration loaded',
        'New SSE subscriber for stream events',
        'GET /api/config',
        'GET /api/logs',
        'POST /api/providers/test',
        'Health check requested',
        'TTS service initialized',
        'Subtitle service ready',
        'Memory compression completed',
        'Agent status updated',
        'Character data loaded',
        'Provider preset created',
        'Config updated successfully',
        'Log stream started',
        'Cache cleared',
        'Session created',
        'Request processed',
        'Data synchronized',
    ],
    'WARN': [
        'High memory usage detected: 85%',
        'Slow query detected: 2.5s',
        'Connection pool nearing limit',
        'Retry attempt 2 of 3',
        'Deprecated API usage detected',
        'Cache miss rate high: 45%',
        'Background task delayed',
        'Rate limit approaching: 80%',
    ],
    'ERROR': [
        'Failed to connect to database',
        'API request timeout after 30s',
        'Invalid configuration value',
        'Authentication failed',
        'File not found: config.json',
        'Service unavailable',
        'Parse error in request body',
        'Insufficient permissions',
    ],
    'DEBUG': [
        'Processing request ID: {id}',
        'Cache hit for key: {key}',
        'Variable value: {value}',
        'Function entry: {func}',
        'SQL query executed: {query}',
    ],
}

async def seed_logs(count: int = 60):
    db = get_db()
    await db.init()
    
    # 清空现有日志
    await db.execute("DELETE FROM system_logs")
    print("Cleared existing logs")
    
    now = datetime.now()
    logs_to_insert = []
    
    for i in range(count):
        # 随机时间（过去24小时内）
        offset_minutes = random.randint(0, 24 * 60)
        timestamp = now - timedelta(minutes=offset_minutes)
        
        # 随机级别（INFO占70%，WARN占15%，ERROR占10%，DEBUG占5%）
        level_weights = ['INFO'] * 70 + ['WARN'] * 15 + ['ERROR'] * 10 + ['DEBUG'] * 5
        level = random.choice(level_weights)
        
        # 随机模块
        module = random.choice(LOG_MODULES)
        
        # 随机消息
        message = random.choice(LOG_MESSAGES[level])
        if '{' in message:
            message = message.format(
                id=random.randint(1000, 9999),
                key=f"cache_{random.randint(1, 100)}",
                value=random.random(),
                func=f"function_{random.randint(1, 10)}",
                query=f"SELECT * FROM table_{random.randint(1, 5)}",
            )
        
        logs_to_insert.append((
            timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            level,
            module,
            message,
            None,  # metadata
        ))
    
    # 按时间排序
    logs_to_insert.sort(key=lambda x: x[0])
    
    # 批量插入
    await db.execute_many(
        """INSERT INTO system_logs (timestamp, level, module, message, metadata) 
        VALUES (?, ?, ?, ?, ?)""",
        logs_to_insert
    )
    
    print(f"Inserted {count} demo logs")
    
    # 显示统计
    total = await db.fetchone("SELECT COUNT(*) as total FROM system_logs")
    error = await db.fetchone("SELECT COUNT(*) as count FROM system_logs WHERE level = 'ERROR'")
    warn = await db.fetchone("SELECT COUNT(*) as count FROM system_logs WHERE level = 'WARN'")
    info = await db.fetchone("SELECT COUNT(*) as count FROM system_logs WHERE level = 'INFO'")
    
    print(f"\nLog statistics:")
    print(f"  Total: {total['total']}")
    print(f"  INFO: {info['count']}")
    print(f"  WARN: {warn['count']}")
    print(f"  ERROR: {error['count']}")
    
    await db.close()

if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    asyncio.run(seed_logs(count))
