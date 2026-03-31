use crate::service_manager::error::{Result, ServiceError};
use crate::types::ServiceConfig;
use std::collections::{HashMap, HashSet, VecDeque};

/// 依赖解析器
pub struct DependencyResolver;

impl DependencyResolver {
    /// 使用 Kahn 算法进行拓扑排序
    pub fn resolve(services: &[ServiceConfig]) -> Result<Vec<String>> {
        let mut in_degree: HashMap<String, usize> = HashMap::new();
        let mut graph: HashMap<String, Vec<String>> = HashMap::new();
        let service_names: HashSet<String> = services.iter().map(|s| s.name.clone()).collect();

        // 初始化入度
        for service in services {
            in_degree.entry(service.name.clone()).or_insert(0);
        }

        // 构建图并计算入度
        for service in services {
            for dep in &service.depends_on {
                // 检查依赖是否存在
                if !service_names.contains(dep) {
                    return Err(ServiceError::ConfigError(
                        format!("Service '{}' depends on unknown service '{}'", service.name, dep)
                    ));
                }

                // 添加边: dep -> service
                graph.entry(dep.clone()).or_default().push(service.name.clone());
                *in_degree.entry(service.name.clone()).or_insert(0) += 1;
            }
        }

        // Kahn 算法
        let mut queue: VecDeque<String> = in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(name, _)| name.clone())
            .collect();

        let mut result = Vec::new();

        while let Some(name) = queue.pop_front() {
            result.push(name.clone());

            if let Some(dependents) = graph.get(&name) {
                for dep in dependents {
                    let deg = in_degree.get_mut(dep).unwrap();
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push_back(dep.clone());
                    }
                }
            }
        }

        // 检查是否有环
        if result.len() != services.len() {
            let mut cycle_services: Vec<String> = in_degree
                .iter()
                .filter(|(_, &deg)| deg > 0)
                .map(|(name, _)| name.clone())
                .collect();
            cycle_services.sort();

            return Err(ServiceError::CircularDependency(
                format!("Circular dependency detected among: {}", cycle_services.join(", "))
            ));
        }

        Ok(result)
    }

    /// 获取服务的所有依赖（包括传递依赖）
    pub fn get_all_dependencies(service: &ServiceConfig, all_services: &[ServiceConfig]) -> Vec<String> {
        let service_map: HashMap<String, &ServiceConfig> = all_services
            .iter()
            .map(|s| (s.name.clone(), s))
            .collect();

        let mut result = Vec::new();
        let mut visited = HashSet::new();
        let mut stack: Vec<String> = service.depends_on.clone();

        while let Some(dep) = stack.pop() {
            if visited.insert(dep.clone()) {
                result.push(dep.clone());

                if let Some(dep_service) = service_map.get(&dep) {
                    for transitive_dep in &dep_service.depends_on {
                        if !visited.contains(transitive_dep) {
                            stack.push(transitive_dep.clone());
                        }
                    }
                }
            }
        }

        result.reverse();
        result
    }

    /// 获取反向依赖（哪些服务依赖于指定服务）
    pub fn get_dependents(service_name: &str, all_services: &[ServiceConfig]) -> Vec<String> {
        all_services
            .iter()
            .filter(|s| s.depends_on.contains(&service_name.to_string()))
            .map(|s| s.name.clone())
            .collect()
    }

    /// 获取关闭顺序（启动顺序的逆序）
    pub fn get_shutdown_order(services: &[ServiceConfig]) -> Result<Vec<String>> {
        let startup_order = Self::resolve(services)?;
        let mut shutdown_order = startup_order;
        shutdown_order.reverse();
        Ok(shutdown_order)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_service(name: &str, deps: Vec<&str>) -> ServiceConfig {
        ServiceConfig {
            name: name.to_string(),
            command: "test".to_string(),
            args: vec![],
            working_dir: ".".to_string(),
            port: 0,
            health_endpoint: "/health".to_string(),
            shutdown_endpoint: "/shutdown".to_string(),
            startup_timeout_secs: 30,
            shutdown_timeout_secs: 10,
            restart_policy: crate::types::RestartPolicy::OnFailure,
            depends_on: deps.into_iter().map(String::from).collect(),
            env_vars: HashMap::new(),
            run_mode: crate::types::RunMode::Development,
            log_level: crate::types::LogLevel::Info,
            max_restarts: 5,
            restart_interval_secs: 5,
        }
    }

    #[test]
    fn test_resolve_simple() {
        let services = vec![
            create_service("a", vec![]),
            create_service("b", vec!["a"]),
            create_service("c", vec!["b"]),
        ];

        let order = DependencyResolver::resolve(&services).unwrap();
        assert_eq!(order, vec!["a", "b", "c"]);
    }

    #[test]
    fn test_resolve_complex() {
        let services = vec![
            create_service("log", vec![]),
            create_service("api", vec!["log"]),
            create_service("ws", vec!["api"]),
        ];

        let order = DependencyResolver::resolve(&services).unwrap();
        assert_eq!(order, vec!["log", "api", "ws"]);
    }

    #[test]
    fn test_circular_dependency() {
        let services = vec![
            create_service("a", vec!["c"]),
            create_service("b", vec!["a"]),
            create_service("c", vec!["b"]),
        ];

        let result = DependencyResolver::resolve(&services);
        assert!(result.is_err());
    }

    #[test]
    fn test_shutdown_order() {
        let services = vec![
            create_service("log", vec![]),
            create_service("api", vec!["log"]),
            create_service("ws", vec!["api"]),
        ];

        let order = DependencyResolver::get_shutdown_order(&services).unwrap();
        assert_eq!(order, vec!["ws", "api", "log"]);
    }
}
