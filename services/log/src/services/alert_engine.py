"""告警触发引擎

实时检查日志并触发告警，支持：
- 阈值告警（单位时间内达到一定数量）
- 速率告警（异常增长率）
- 模式匹配告警（关键字匹配）
- 冷却机制（避免频繁告警）
- 多种通知方式（SSE、Webhook、日志）
"""

import asyncio
import json
import re
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import aiohttp


@dataclass
class AlertRule:
    """告警规则"""
    id: int
    name: str
    description: Optional[str]
    enabled: bool
    level_min: Optional[str]
    module_pattern: Optional[str]
    message_pattern: Optional[str]
    condition_type: str
    threshold_count: Optional[int]
    time_window: Optional[int]
    notify_type: Optional[str]
    notify_config: Optional[Dict[str, Any]]
    cooldown_seconds: int
    last_triggered_at: Optional[datetime] = None


@dataclass
class AlertEvent:
    """告警事件"""
    rule_id: int
    rule_name: str
    severity: str
    message: str
    context: Dict[str, Any]
    triggered_at: datetime = field(default_factory=datetime.utcnow)


class AlertEngine:
    """告警引擎"""

    def __init__(self, db_manager=None):
        self.db = db_manager
        self._rules: Dict[int, AlertRule] = {}
        self._running = False
        self._check_task: Optional[asyncio.Task] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._callbacks: List[Callable[[AlertEvent], None]] = []

        # 内存中的日志缓存（用于阈值检查）
        self._log_buffer: List[Dict[str, Any]] = []
        self._buffer_lock = asyncio.Lock()
        self._max_buffer_size = 10000

        # 告警历史缓存（用于冷却检查）
        self._alert_history: Dict[int, datetime] = {}

    async def start(self):
        """启动告警引擎"""
        if self._running:
            return

        self._running = True

        # 加载告警规则
        await self._load_rules()

        # 启动检查循环
        self._check_task = asyncio.create_task(self._check_loop())

        # 启动缓冲区清理任务
        asyncio.create_task(self._buffer_cleanup_loop())

        print("✅ Alert engine started")

    async def stop(self):
        """停止告警引擎"""
        self._running = False

        if self._check_task:
            self._check_task.cancel()
            try:
                await self._check_task
            except asyncio.CancelledError:
                pass

        if self._session and not self._session.closed:
            await self._session.close()

        print("🛑 Alert engine stopped")

    async def _get_session(self) -> aiohttp.ClientSession:
        """获取HTTP会话"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
        return self._session

    async def _load_rules(self):
        """从数据库加载告警规则"""
        if not self.db or not self.db.db:
            return

        try:
            cursor = await self.db.db.execute(
                "SELECT * FROM alert_rules WHERE enabled = 1"
            )
            rows = await cursor.fetchall()

            self._rules.clear()
            for row in rows:
                rule = AlertRule(
                    id=row['id'],
                    name=row['name'],
                    description=row['description'],
                    enabled=bool(row['enabled']),
                    level_min=row['level_min'],
                    module_pattern=row['module_pattern'],
                    message_pattern=row['message_pattern'],
                    condition_type=row['condition_type'],
                    threshold_count=row['threshold_count'],
                    time_window=row['time_window'],
                    notify_type=row['notify_type'],
                    notify_config=json.loads(row['notify_config']) if row['notify_config'] else None,
                    cooldown_seconds=row['cooldown_seconds'],
                    last_triggered_at=row['last_triggered_at']
                )
                self._rules[rule.id] = rule

        except Exception as e:
            print(f"⚠️ Failed to load alert rules: {e}")

    async def reload_rules(self):
        """重新加载告警规则"""
        await self._load_rules()

    async def process_log(self, log: Dict[str, Any]):
        """处理单条日志，检查是否触发告警"""
        if not self._running or not self._rules:
            return

        # 添加到缓冲区
        async with self._buffer_lock:
            self._log_buffer.append({
                **log,
                '_received_at': datetime.utcnow()
            })
            # 限制缓冲区大小
            if len(self._log_buffer) > self._max_buffer_size:
                self._log_buffer = self._log_buffer[-self._max_buffer_size:]

        # 立即检查模式匹配类告警
        await self._check_pattern_alerts(log)

    async def _check_pattern_alerts(self, log: Dict[str, Any]):
        """检查模式匹配告警"""
        for rule in self._rules.values():
            if not rule.enabled:
                continue

            if rule.condition_type != 'pattern':
                continue

            # 检查级别
            if rule.level_min:
                log_level = log.get('level', '')
                level_order = {'DEBUG': 0, 'INFO': 1, 'WARNING': 2, 'ERROR': 3, 'CRITICAL': 4}
                if level_order.get(log_level, 0) < level_order.get(rule.level_min, 0):
                    continue

            # 检查模块匹配
            if rule.module_pattern:
                module = log.get('module', '')
                pattern = rule.module_pattern.replace('*', '.*')
                if not re.search(pattern, module):
                    continue

            # 检查消息匹配
            if rule.message_pattern:
                message = log.get('message', '')
                if not re.search(rule.message_pattern, message):
                    continue

            # 检查冷却时间
            if await self._is_in_cooldown(rule):
                continue

            # 触发告警
            await self._trigger_alert(rule, log)

    async def _check_loop(self):
        """定期检查阈值类告警"""
        while self._running:
            try:
                await asyncio.sleep(10)  # 每10秒检查一次

                if not self._rules:
                    continue

                for rule in self._rules.values():
                    if not rule.enabled:
                        continue

                    if rule.condition_type == 'threshold':
                        await self._check_threshold_alert(rule)
                    elif rule.condition_type == 'rate':
                        await self._check_rate_alert(rule)

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"⚠️ Alert check error: {e}")

    async def _check_threshold_alert(self, rule: AlertRule):
        """检查阈值告警"""
        if not rule.threshold_count or not rule.time_window:
            return

        # 检查冷却时间
        if await self._is_in_cooldown(rule):
            return

        # 计算时间窗口
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=rule.time_window)

        # 统计窗口内的日志
        count = 0
        matched_logs = []

        async with self._buffer_lock:
            for log in self._log_buffer:
                received_at = log.get('_received_at')
                if not received_at or received_at < window_start:
                    continue

                # 检查级别
                if rule.level_min:
                    log_level = log.get('level', '')
                    level_order = {'DEBUG': 0, 'INFO': 1, 'WARNING': 2, 'ERROR': 3, 'CRITICAL': 4}
                    if level_order.get(log_level, 0) < level_order.get(rule.level_min, 0):
                        continue

                # 检查模块匹配
                if rule.module_pattern:
                    module = log.get('module', '')
                    pattern = rule.module_pattern.replace('*', '.*')
                    if not re.search(pattern, module):
                        continue

                # 检查消息匹配
                if rule.message_pattern:
                    message = log.get('message', '')
                    if not re.search(rule.message_pattern, message):
                        continue

                count += 1
                matched_logs.append(log)

        # 检查是否达到阈值
        if count >= rule.threshold_count:
            await self._trigger_alert(rule, {
                'count': count,
                'threshold': rule.threshold_count,
                'time_window': rule.time_window,
                'matched_logs': matched_logs[:10]  # 只保留前10条
            })

    async def _check_rate_alert(self, rule: AlertRule):
        """检查速率告警"""
        # 简化实现：检查最近两个时间窗口的日志增长率
        if not rule.threshold_count or not rule.time_window:
            return

        # 检查冷却时间
        if await self._is_in_cooldown(rule):
            return

        now = datetime.utcnow()
        current_window_start = now - timedelta(seconds=rule.time_window)
        previous_window_start = current_window_start - timedelta(seconds=rule.time_window)

        current_count = 0
        previous_count = 0

        async with self._buffer_lock:
            for log in self._log_buffer:
                received_at = log.get('_received_at')
                if not received_at:
                    continue

                # 应用过滤条件
                if rule.level_min:
                    log_level = log.get('level', '')
                    level_order = {'DEBUG': 0, 'INFO': 1, 'WARNING': 2, 'ERROR': 3, 'CRITICAL': 4}
                    if level_order.get(log_level, 0) < level_order.get(rule.level_min, 0):
                        continue

                if rule.module_pattern:
                    module = log.get('module', '')
                    pattern = rule.module_pattern.replace('*', '.*')
                    if not re.search(pattern, module):
                        continue

                # 统计窗口
                if received_at >= current_window_start:
                    current_count += 1
                elif received_at >= previous_window_start:
                    previous_count += 1

        # 检查增长率
        if previous_count > 0:
            growth_rate = (current_count - previous_count) / previous_count
            if growth_rate >= rule.threshold_count / 100:  # threshold_count 作为百分比
                await self._trigger_alert(rule, {
                    'current_count': current_count,
                    'previous_count': previous_count,
                    'growth_rate': f"{growth_rate * 100:.1f}%",
                    'threshold': rule.threshold_count
                })

    async def _is_in_cooldown(self, rule: AlertRule) -> bool:
        """检查是否在冷却期内"""
        last_triggered = self._alert_history.get(rule.id)
        if not last_triggered:
            # 检查数据库中的最后触发时间
            if rule.last_triggered_at:
                last_triggered = rule.last_triggered_at
                if isinstance(last_triggered, str):
                    last_triggered = datetime.fromisoformat(last_triggered)

        if last_triggered:
            elapsed = (datetime.utcnow() - last_triggered).total_seconds()
            return elapsed < rule.cooldown_seconds

        return False

    async def _trigger_alert(self, rule: AlertRule, context: Any):
        """触发告警"""
        now = datetime.utcnow()

        # 更新最后触发时间
        self._alert_history[rule.id] = now
        rule.last_triggered_at = now

        # 确定告警级别
        severity = 'warning'
        if rule.level_min == 'CRITICAL':
            severity = 'critical'
        elif rule.level_min == 'ERROR':
            severity = 'error'

        # 构建告警消息
        if isinstance(context, dict) and 'count' in context:
            message = f"{rule.name}: 检测到 {context['count']} 条匹配日志"
        else:
            message = f"{rule.name}: {rule.description or '触发告警'}"

        # 创建告警事件
        event = AlertEvent(
            rule_id=rule.id,
            rule_name=rule.name,
            severity=severity,
            message=message,
            context=context if isinstance(context, dict) else {'log': context}
        )

        # 保存到数据库
        await self._save_alert_history(event)

        # 发送通知
        await self._send_notification(rule, event)

        # 调用回调
        for callback in self._callbacks:
            try:
                callback(event)
            except Exception:
                pass

        print(f"🚨 Alert triggered: {rule.name} ({severity})")

    async def _save_alert_history(self, event: AlertEvent):
        """保存告警历史"""
        if not self.db or not self.db.db:
            return

        try:
            await self.db.db.execute("""
                INSERT INTO alert_history
                (rule_id, triggered_at, severity, message, context, notified)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                event.rule_id,
                event.triggered_at.isoformat(),
                event.severity,
                event.message,
                json.dumps(event.context, default=str),
                True
            ))
            await self.db.db.commit()
        except Exception as e:
            print(f"⚠️ Failed to save alert history: {e}")

    async def _send_notification(self, rule: AlertRule, event: AlertEvent):
        """发送告警通知"""
        if not rule.notify_type:
            return

        try:
            if rule.notify_type == 'webhook':
                await self._send_webhook_notification(rule, event)
            elif rule.notify_type == 'sse':
                # SSE 通知由调用方处理
                pass
            elif rule.notify_type == 'log':
                print(f"[ALERT] {event.severity.upper()}: {event.message}")
        except Exception as e:
            print(f"⚠️ Failed to send notification: {e}")

    async def _send_webhook_notification(self, rule: AlertRule, event: AlertEvent):
        """发送Webhook通知"""
        if not rule.notify_config or 'url' not in rule.notify_config:
            return

        url = rule.notify_config['url']
        headers = rule.notify_config.get('headers', {})

        payload = {
            'rule_id': event.rule_id,
            'rule_name': event.rule_name,
            'severity': event.severity,
            'message': event.message,
            'context': event.context,
            'triggered_at': event.triggered_at.isoformat()
        }

        session = await self._get_session()
        async with session.post(url, json=payload, headers=headers) as response:
            if response.status >= 400:
                raise aiohttp.ClientError(f"Webhook returned {response.status}")

    async def _buffer_cleanup_loop(self):
        """定期清理过期日志缓冲区"""
        while self._running:
            try:
                await asyncio.sleep(60)  # 每分钟清理一次

                cutoff = datetime.utcnow() - timedelta(hours=1)

                async with self._buffer_lock:
                    self._log_buffer = [
                        log for log in self._log_buffer
                        if log.get('_received_at', datetime.utcnow()) > cutoff
                    ]

            except asyncio.CancelledError:
                break
            except Exception:
                pass

    def add_callback(self, callback: Callable[[AlertEvent], None]):
        """添加告警回调"""
        self._callbacks.append(callback)

    def remove_callback(self, callback: Callable[[AlertEvent], None]):
        """移除告警回调"""
        if callback in self._callbacks:
            self._callbacks.remove(callback)

    async def get_active_alerts(self) -> List[Dict[str, Any]]:
        """获取当前活跃的告警"""
        now = datetime.utcnow()
        active_alerts = []

        for rule_id, last_triggered in self._alert_history.items():
            rule = self._rules.get(rule_id)
            if not rule:
                continue

            # 检查是否仍在关注期内（5分钟内）
            if (now - last_triggered).total_seconds() < 300:
                active_alerts.append({
                    'rule_id': rule_id,
                    'rule_name': rule.name,
                    'severity': 'warning' if rule.level_min != 'CRITICAL' else 'critical',
                    'last_triggered': last_triggered.isoformat(),
                    'message': rule.description
                })

        return active_alerts


# 全局告警引擎实例
_alert_engine: Optional[AlertEngine] = None


async def get_alert_engine(db_manager=None) -> AlertEngine:
    """获取告警引擎实例"""
    global _alert_engine
    if _alert_engine is None:
        _alert_engine = AlertEngine(db_manager)
    return _alert_engine
