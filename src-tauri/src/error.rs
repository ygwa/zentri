//! 统一错误处理模块
//! 定义应用级别的错误类型，统一错误处理

use thiserror::Error;

/// 应用错误类型
#[derive(Error, Debug)]
pub enum AppError {
    /// 数据库错误
    #[error("数据库错误: {0}")]
    Database(#[from] sqlx::Error),

    /// 文件系统错误
    #[error("文件系统错误: {0}")]
    Io(#[from] std::io::Error),

    /// JSON 序列化/反序列化错误
    #[error("JSON 错误: {0}")]
    Json(#[from] serde_json::Error),

    /// YAML 序列化/反序列化错误
    #[error("YAML 错误: {0}")]
    Yaml(#[from] serde_yaml::Error),

    /// 未找到资源
    #[error("未找到: {0}")]
    NotFound(String),

    /// 无效输入
    #[error("无效输入: {0}")]
    InvalidInput(String),

    /// Vault 路径未设置
    #[error("Vault 路径未设置")]
    VaultPathNotSet,

    /// 存储错误
    #[error("存储错误: {0}")]
    Storage(String),

    /// 搜索错误
    #[error("搜索错误: {0}")]
    Search(String),

    /// 图谱错误
    #[error("图谱错误: {0}")]
    Graph(String),

    /// CRDT 错误
    #[error("CRDT 错误: {0}")]
    Crdt(String),

    /// 文件监听错误
    #[error("文件监听错误: {0}")]
    Watcher(String),

    /// 网页读取错误
    #[error("网页读取错误: {0}")]
    WebReader(String),
}

/// 结果类型别名
#[allow(dead_code)]
pub type AppResult<T> = Result<T, AppError>;

/// 转换为 Tauri 命令错误（String）
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}

/// 转换为 Tauri InvokeError（用于 Tauri 命令）
impl From<AppError> for tauri::ipc::InvokeError {
    fn from(err: AppError) -> Self {
        tauri::ipc::InvokeError::from(err.to_string())
    }
}

/// 从 rusqlite::Error 转换（用于迁移期间的兼容）
impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Storage(format!("数据库错误: {}", err))
    }
}

