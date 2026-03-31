"""
告警服务 API 路由
"""
import json
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Query, HTTPException, Path

try:
    from ..models.schemas import AlertRule, BaseResponse
    from ..core.database import get_db
    from ..services.alert_engine import get_alert_engine
except ImportError:
    from models.schemas import AlertRule, BaseResponse
    from core.database import get_db
    from services.alert_engine import get_alert_engine

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("/rules", response_model=BaseResponse)
async def create_alert_rule(rule: AlertRule):
    """创建告警规则"""
    try:
        db = await get_db()

        cursor = await db.db.execute("""
            INSERT INTO alert_rules
            (name, description, enabled, level_min, module_pattern, message_pattern,
             condition_type, threshold_count, time_window, notify_type, notify_config, cooldown_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rule.name,
            rule.description,
            int(rule.enabled),
            rule.level_min,
            rule.module_pattern,
            rule.message_pattern,
            rule.condition_type,
            rule.threshold_count,
            rule.time_window,
            rule.notify_type,
            json.dumps(rule.notify_config) if rule.notify_config else None,
            rule.cooldown_seconds
        ))

        await db.db.commit()
        rule_id = cursor.lastrowid

        # 重新加载告警规则
        alert_engine = await get_alert_engine()
        await alert_engine.reload_rules()

        return BaseResponse(data={"id": rule_id, **rule.dict()})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rules", response_model=BaseResponse)
async def list_alert_rules(
    enabled: Optional[bool] = Query(None)
):
    """列出告警规则"""
    try:
        db = await get_db()

        query = "SELECT * FROM alert_rules"
        params = []

        if enabled is not None:
            query += " WHERE enabled = ?"
            params.append(int(enabled))

        query += " ORDER BY created_at DESC"

        cursor = await db.db.execute(query, params)
        rows = await cursor.fetchall()

        rules = []
        for row in rows:
            rules.append({
                "id": row['id'],
                "name": row['name'],
                "description": row['description'],
                "enabled": bool(row['enabled']),
                "level_min": row['level_min'],
                "module_pattern": row['module_pattern'],
                "message_pattern": row['message_pattern'],
                "condition_type": row['condition_type'],
                "threshold_count": row['threshold_count'],
                "time_window": row['time_window'],
                "notify_type": row['notify_type'],
                "notify_config": json.loads(row['notify_config']) if row['notify_config'] else None,
                "cooldown_seconds": row['cooldown_seconds'],
                "last_triggered_at": row['last_triggered_at'],
                "created_at": row['created_at'],
                "updated_at": row['updated_at']
            })

        return BaseResponse(data=rules)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rules/{rule_id}", response_model=BaseResponse)
async def get_alert_rule(
    rule_id: int = Path(..., ge=1)
):
    """获取单个告警规则"""
    try:
        db = await get_db()

        cursor = await db.db.execute(
            "SELECT * FROM alert_rules WHERE id = ?",
            (rule_id,)
        )
        row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Alert rule not found")

        rule = {
            "id": row['id'],
            "name": row['name'],
            "description": row['description'],
            "enabled": bool(row['enabled']),
            "level_min": row['level_min'],
            "module_pattern": row['module_pattern'],
            "message_pattern": row['message_pattern'],
            "condition_type": row['condition_type'],
            "threshold_count": row['threshold_count'],
            "time_window": row['time_window'],
            "notify_type": row['notify_type'],
            "notify_config": json.loads(row['notify_config']) if row['notify_config'] else None,
            "cooldown_seconds": row['cooldown_seconds'],
            "last_triggered_at": row['last_triggered_at'],
            "created_at": row['created_at'],
            "updated_at": row['updated_at']
        }

        return BaseResponse(data=rule)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/rules/{rule_id}", response_model=BaseResponse)
async def update_alert_rule(
    rule: AlertRule,
    rule_id: int = Path(..., ge=1)
):
    """更新告警规则"""
    try:
        db = await get_db()

        # 检查规则是否存在
        cursor = await db.db.execute(
            "SELECT id FROM alert_rules WHERE id = ?",
            (rule_id,)
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Alert rule not found")

        await db.db.execute("""
            UPDATE alert_rules SET
                name = ?,
                description = ?,
                enabled = ?,
                level_min = ?,
                module_pattern = ?,
                message_pattern = ?,
                condition_type = ?,
                threshold_count = ?,
                time_window = ?,
                notify_type = ?,
                notify_config = ?,
                cooldown_seconds = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            rule.name,
            rule.description,
            int(rule.enabled),
            rule.level_min,
            rule.module_pattern,
            rule.message_pattern,
            rule.condition_type,
            rule.threshold_count,
            rule.time_window,
            rule.notify_type,
            json.dumps(rule.notify_config) if rule.notify_config else None,
            rule.cooldown_seconds,
            rule_id
        ))

        await db.db.commit()

        # 重新加载告警规则
        alert_engine = await get_alert_engine()
        await alert_engine.reload_rules()

        return BaseResponse(data={"id": rule_id, **rule.dict()})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/rules/{rule_id}", response_model=BaseResponse)
async def delete_alert_rule(
    rule_id: int = Path(..., ge=1)
):
    """删除告警规则"""
    try:
        db = await get_db()

        # 检查规则是否存在
        cursor = await db.db.execute(
            "SELECT id FROM alert_rules WHERE id = ?",
            (rule_id,)
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Alert rule not found")

        await db.db.execute("DELETE FROM alert_rules WHERE id = ?", (rule_id,))
        await db.db.commit()

        # 重新加载告警规则
        alert_engine = await get_alert_engine()
        await alert_engine.reload_rules()

        return BaseResponse(message=f"Alert rule {rule_id} deleted")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rules/{rule_id}/toggle", response_model=BaseResponse)
async def toggle_alert_rule(
    rule_id: int = Path(..., ge=1)
):
    """切换告警规则启用状态"""
    try:
        db = await get_db()

        cursor = await db.db.execute(
            "SELECT enabled FROM alert_rules WHERE id = ?",
            (rule_id,)
        )
        row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Alert rule not found")

        new_status = not bool(row['enabled'])

        await db.db.execute(
            "UPDATE alert_rules SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (int(new_status), rule_id)
        )
        await db.db.commit()

        # 重新加载告警规则
        alert_engine = await get_alert_engine()
        await alert_engine.reload_rules()

        return BaseResponse(data={"id": rule_id, "enabled": new_status})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=BaseResponse)
async def get_alert_history(
    rule_id: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200)
):
    """获取告警历史"""
    try:
        db = await get_db()

        conditions = []
        params = []

        if rule_id:
            conditions.append("rule_id = ?")
            params.append(rule_id)
        if severity:
            conditions.append("severity = ?")
            params.append(severity)
        if start_time:
            conditions.append("triggered_at >= ?")
            params.append(start_time.isoformat())
        if end_time:
            conditions.append("triggered_at <= ?")
            params.append(end_time.isoformat())

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        # 获取总数
        count_sql = f"SELECT COUNT(*) FROM alert_history {where_clause}"
        cursor = await db.db.execute(count_sql, params)
        total = (await cursor.fetchone())[0]

        # 分页查询
        offset = (page - 1) * page_size
        query = f"""
            SELECT h.*, r.name as rule_name
            FROM alert_history h
            LEFT JOIN alert_rules r ON h.rule_id = r.id
            {where_clause}
            ORDER BY h.triggered_at DESC
            LIMIT ? OFFSET ?
        """
        cursor = await db.db.execute(query, params + [page_size, offset])
        rows = await cursor.fetchall()

        items = []
        for row in rows:
            items.append({
                "id": row['id'],
                "rule_id": row['rule_id'],
                "rule_name": row['rule_name'],
                "triggered_at": row['triggered_at'],
                "resolved_at": row['resolved_at'],
                "severity": row['severity'],
                "message": row['message'],
                "context": json.loads(row['context']) if row['context'] else None,
                "notified": bool(row['notified'])
            })

        return BaseResponse(data={
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/active", response_model=BaseResponse)
async def get_active_alerts():
    """获取当前活跃的告警"""
    try:
        alert_engine = await get_alert_engine()
        alerts = await alert_engine.get_active_alerts()
        return BaseResponse(data=alerts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reload", response_model=BaseResponse)
async def reload_alert_rules():
    """重新加载告警规则"""
    try:
        alert_engine = await get_alert_engine()
        await alert_engine.reload_rules()
        return BaseResponse(message="Alert rules reloaded successfully")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
