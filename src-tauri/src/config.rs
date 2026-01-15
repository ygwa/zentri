//! 应用配置管理模块
//! 使用文件系统存储应用配置（不依赖数据库）

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

/// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// 当前使用的 vault 路径
    pub vault_path: Option<String>,
    /// 应用版本
    pub version: String,
    /// 其他应用设置
    #[serde(default)]
    pub settings: AppSettings,
}

/// 应用设置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    /// 默认卡片类型
    #[serde(default = "default_card_type")]
    pub default_card_type: String,
    /// 自动保存间隔（毫秒）
    #[serde(default = "default_auto_save_interval")]
    pub auto_save_interval: u64,
}

fn default_card_type() -> String {
    "fleeting".to_string()
}

fn default_auto_save_interval() -> u64 {
    5000
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            vault_path: None,
            version: env!("CARGO_PKG_VERSION").to_string(),
            settings: AppSettings::default(),
        }
    }
}

/// 配置管理器
pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    /// 创建配置管理器
    pub fn new(app_data_dir: &Path) -> Self {
        let config_path = app_data_dir.join("config.json");
        Self { config_path }
    }

    /// 获取配置路径
    pub fn config_path(&self) -> &Path {
        &self.config_path
    }

    /// 加载配置
    pub fn load(&self) -> Result<AppConfig, ConfigError> {
        if self.config_path.exists() {
            let content = fs::read_to_string(&self.config_path)?;
            let config: AppConfig = serde_json::from_str(&content)?;
            Ok(config)
        } else {
            // 如果配置文件不存在，创建默认配置
            let config = AppConfig::default();
            self.save(&config)?;
            Ok(config)
        }
    }

    /// 保存配置
    pub fn save(&self, config: &AppConfig) -> Result<(), ConfigError> {
        // 确保目录存在
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(config)?;
        fs::write(&self.config_path, content)?;
        Ok(())
    }

    /// 获取 vault 路径
    pub fn get_vault_path(&self) -> Result<Option<PathBuf>, ConfigError> {
        let config = self.load()?;
        Ok(config.vault_path.map(PathBuf::from))
    }

    /// 设置 vault 路径
    pub fn set_vault_path(&self, vault_path: Option<&Path>) -> Result<(), ConfigError> {
        let mut config = self.load()?;
        config.vault_path = vault_path.map(|p| p.to_string_lossy().to_string());
        self.save(&config)?;
        Ok(())
    }

    /// 更新设置
    pub fn update_settings<F>(&self, updater: F) -> Result<(), ConfigError>
    where
        F: FnOnce(&mut AppSettings),
    {
        let mut config = self.load()?;
        updater(&mut config.settings);
        self.save(&config)?;
        Ok(())
    }
}

