use crate::types::{LogEntry, LogLevel, LogQuery};
use chrono::Utc;
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;

/// 日志聚合器
pub struct LogAggregator {
    /// 日志缓冲区
    buffer: Arc<RwLock<VecDeque<LogEntry>>>,
    /// 最大缓冲区大小
    max_size: usize,
}

impl LogAggregator {
    /// 创建新的日志聚合器
    pub fn new(max_size: usize) -> Self {
        Self {
            buffer: Arc::new(RwLock::new(VecDeque::with_capacity(max_size))),
            max_size,
        }
    }

    /// 接收日志条目
    pub async fn ingest(&self, entry: LogEntry) {
        let mut buffer = self.buffer.write().await;

        // 如果缓冲区已满，移除最旧的条目
        if buffer.len() >= self.max_size {
            buffer.pop_front();
        }

        buffer.push_back(entry);
    }

    /// 批量接收日志
    pub async fn ingest_batch(&self, entries: Vec<LogEntry>) {
        let mut buffer = self.buffer.write().await;

        for entry in entries {
            if buffer.len() >= self.max_size {
                buffer.pop_front();
            }
            buffer.push_back(entry);
        }
    }

    /// 查询日志
    pub async fn query(&self, query: LogQuery) -> Vec<LogEntry> {
        let buffer = self.buffer.read().await;
        let limit = query.limit.unwrap_or(100);

        buffer
            .iter()
            .filter(|entry| {
                // 服务过滤
                if let Some(ref services) = query.services {
                    if !services.contains(&entry.service) {
                        return false;
                    }
                }

                // 日志级别过滤
                if let Some(ref level) = query.level {
                    if entry.level < *level {
                        return false;
                    }
                }

                // 时间范围过滤
                if let Some(ref start) = query.start_time {
                    if entry.timestamp < *start {
                        return false;
                    }
                }

                if let Some(ref end) = query.end_time {
                    if entry.timestamp > *end {
                        return false;
                    }
                }

                // 关键词搜索
                if let Some(ref search) = query.search {
                    if !entry.message.to_lowercase().contains(&search.to_lowercase()) {
                        return false;
                    }
                }

                true
            })
            .cloned()
            .take(limit)
            .collect()
    }

    /// 获取所有日志
    pub async fn get_all(&self, limit: usize) -> Vec<LogEntry> {
        let buffer = self.buffer.read().await;
        buffer.iter().rev().take(limit).cloned().collect()
    }

    /// 获取服务的最新日志
    pub async fn get_service_logs(&self, service: &str, limit: usize) -> Vec<LogEntry> {
        let buffer = self.buffer.read().await;
        buffer
            .iter()
            .rev()
            .filter(|e| e.service == service)
            .take(limit)
            .cloned()
            .collect()
    }

    /// 清空日志
    pub async fn clear(&self) {
        let mut buffer = self.buffer.write().await;
        buffer.clear();
    }

    /// 获取缓冲区大小
    pub async fn len(&self) -> usize {
        let buffer = self.buffer.read().await;
        buffer.len()
    }

    /// 检查是否为空
    pub async fn is_empty(&self) -> bool {
        let buffer = self.buffer.read().await;
        buffer.is_empty()
    }
}

impl Default for LogAggregator {
    fn default() -> Self {
        Self::new(10000) // 默认最多保存 10000 条日志
    }
}

/// 日志解析器
pub struct LogParser;

impl LogParser {
    /// 解析标准日志行
    /// 支持格式: [LEVEL] message 或 timestamp [LEVEL] message
    pub fn parse_line(line: &str, service_name: &str) -> Option<LogEntry> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return None;
        }

        // 尝试解析日志级别
        let (level, message) = Self::extract_level(trimmed);

        Some(LogEntry {
            timestamp: Utc::now(),
            service: service_name.to_string(),
            level,
            message: message.to_string(),
            source: None,
        })
    }

    /// 提取日志级别
    fn extract_level(line: &str) -> (LogLevel, &str) {
        let upper = line.to_uppercase();

        if upper.contains("ERROR") || upper.contains("[ERR]") {
            (LogLevel::Error, line)
        } else if upper.contains("WARN") || upper.contains("[WRN]") {
            (LogLevel::Warn, line)
        } else if upper.contains("DEBUG") || upper.contains("[DBG]") {
            (LogLevel::Debug, line)
        } else if upper.contains("INFO") || upper.contains("[INF]") {
            (LogLevel::Info, line)
        } else {
            (LogLevel::Info, line)
        }
    }

    /// 解析 Python uvicorn 日志格式
    pub fn parse_uvicorn_log(line: &str, service_name: &str) -> Option<LogEntry> {
        // Uvicorn 格式: INFO:     2024-01-01 00:00:00,000 - message
        // 或: 2024-01-01 00:00:00.000 | INFO | message

        let trimmed = line.trim();
        if trimmed.is_empty() {
            return None;
        }

        let (level, message) = if trimmed.starts_with("INFO:") {
            (LogLevel::Info, &trimmed[5..])
        } else if trimmed.starts_with("WARNING:") {
            (LogLevel::Warn, &trimmed[8..])
        } else if trimmed.starts_with("ERROR:") {
            (LogLevel::Error, &trimmed[6..])
        } else if trimmed.starts_with("DEBUG:") {
            (LogLevel::Debug, &trimmed[6..])
        } else {
            Self::extract_level(trimmed)
        };

        Some(LogEntry {
            timestamp: Utc::now(),
            service: service_name.to_string(),
            level,
            message: message.trim().to_string(),
            source: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_line() {
        let entry = LogParser::parse_line("[ERROR] Something went wrong", "test-service").unwrap();
        assert_eq!(entry.level, LogLevel::Error);
        assert!(entry.message.contains("Something went wrong"));
        assert_eq!(entry.service, "test-service");
    }

    #[test]
    fn test_parse_uvicorn() {
        let entry = LogParser::parse_uvicorn_log(
            "INFO:     Application startup complete.",
            "api-gateway"
        ).unwrap();
        assert_eq!(entry.level, LogLevel::Info);
        assert_eq!(entry.service, "api-gateway");
    }

    #[tokio::test]
    async fn test_log_aggregator() {
        let aggregator = LogAggregator::new(100);

        let entry = LogEntry {
            timestamp: Utc::now(),
            service: "test".to_string(),
            level: LogLevel::Info,
            message: "Test message".to_string(),
            source: None,
        };

        aggregator.ingest(entry.clone()).await;

        let logs = aggregator.get_service_logs("test", 10).await;
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].message, "Test message");
    }
}
