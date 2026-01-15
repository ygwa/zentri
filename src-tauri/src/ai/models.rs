//! 模型管理
//! 负责模型的下载、验证、存储和列表管理

use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;
use dirs::data_dir;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use futures_util::StreamExt;

#[derive(Debug, Error)]
pub enum ModelError {
    #[error("Model file not found: {0}")]
    NotFound(String),
    #[error("Download failed: {0}")]
    DownloadFailed(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Network error: {0}")]
    Network(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub size: u64, // bytes
    pub url: String,
    pub description: Option<String>,
}

/// 预定义的模型列表
pub fn get_available_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "qwen2.5-7b-int4".to_string(),
            name: "Qwen2.5-7B-Int4".to_string(),
            size: 4_000_000_000, // ~4GB
            url: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf".to_string(),
            description: Some("推荐模型，平衡性能和资源占用".to_string()),
        },
        ModelInfo {
            id: "qwen2.5-1.5b-int4".to_string(),
            name: "Qwen2.5-1.5B-Int4".to_string(),
            size: 1_000_000_000, // ~1GB
            url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf".to_string(),
            description: Some("轻量级模型，适合低配置设备".to_string()),
        },
    ]
}

/// 模型管理器
pub struct ModelManager {
    models_dir: PathBuf,
}

impl ModelManager {
    pub fn new() -> Result<Self, ModelError> {
        let app_data_dir = data_dir()
            .ok_or_else(|| ModelError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Cannot find application data directory"
            )))?
            .join("zentri")
            .join("models");

        // 确保目录存在
        fs::create_dir_all(&app_data_dir)?;

        Ok(Self {
            models_dir: app_data_dir,
        })
    }

    /// 获取模型存储目录
    pub fn get_models_dir(&self) -> &Path {
        &self.models_dir
    }

    /// 获取模型文件路径
    pub fn get_model_path(&self, model_id: &str) -> PathBuf {
        self.models_dir.join(format!("{}.gguf", model_id))
    }

    /// 检查模型是否已下载
    pub fn is_model_downloaded(&self, model_id: &str) -> bool {
        self.get_model_path(model_id).exists()
    }

    /// 获取已下载的模型列表
    pub fn list_downloaded_models(&self) -> Result<Vec<String>, ModelError> {
        let mut models = Vec::new();
        
        if !self.models_dir.exists() {
            return Ok(models);
        }

        for entry in fs::read_dir(&self.models_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("gguf") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    models.push(stem.to_string());
                }
            }
        }

        Ok(models)
    }

    /// 下载模型（支持断点续传）
    pub async fn download_model(
        &self,
        model_info: &ModelInfo,
        on_progress: Option<Box<dyn Fn(u64, u64) + Send>>,
    ) -> Result<PathBuf, ModelError> {
        let model_path = self.get_model_path(&model_info.id);
        
        // 检查是否已存在
        if model_path.exists() {
            let metadata = fs::metadata(&model_path)?;
            if metadata.len() == model_info.size {
                // 文件已完整下载
                return Ok(model_path);
            }
        }

        // 创建 HTTP 客户端
        let client = reqwest::Client::new();
        
        // 检查现有文件大小（断点续传）
        let mut downloaded_bytes = if model_path.exists() {
            fs::metadata(&model_path)?.len()
        } else {
            0
        };

        // 发送请求（支持 Range 头以支持断点续传）
        let mut request = client.get(&model_info.url);
        if downloaded_bytes > 0 {
            request = request.header("Range", format!("bytes={}-", downloaded_bytes));
        }

        let response = request
            .send()
            .await
            .map_err(|e| ModelError::Network(e.to_string()))?;

        if !response.status().is_success() && response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
            return Err(ModelError::DownloadFailed(format!(
                "HTTP error: {}",
                response.status()
            )));
        }

        // 打开文件（追加模式以支持断点续传）
        let mut file = if downloaded_bytes > 0 {
            fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&model_path)?
        } else {
            fs::File::create(&model_path)?
        };

        // 下载数据
        let mut stream = response.bytes_stream();
        let total_size = model_info.size;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| ModelError::Network(e.to_string()))?;
            file.write_all(&chunk)?;
            downloaded_bytes += chunk.len() as u64;

            // 调用进度回调
            if let Some(ref callback) = on_progress {
                callback(downloaded_bytes, total_size);
            }
        }

        // 验证文件大小
        let final_size = fs::metadata(&model_path)?.len();
        if final_size != model_info.size {
            return Err(ModelError::DownloadFailed(format!(
                "File size mismatch: expected {}, got {}",
                model_info.size, final_size
            )));
        }

        Ok(model_path)
    }

    /// 删除模型文件
    pub fn delete_model(&self, model_id: &str) -> Result<(), ModelError> {
        let model_path = self.get_model_path(model_id);
        if model_path.exists() {
            fs::remove_file(&model_path)?;
        }
        Ok(())
    }

    /// 获取模型文件大小
    pub fn get_model_size(&self, model_id: &str) -> Result<u64, ModelError> {
        let model_path = self.get_model_path(model_id);
        if !model_path.exists() {
            return Err(ModelError::NotFound(model_id.to_string()));
        }
        Ok(fs::metadata(&model_path)?.len())
    }
}

impl Default for ModelManager {
    fn default() -> Self {
        Self::new().expect("Failed to initialize ModelManager")
    }
}

