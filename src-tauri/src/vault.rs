//! Vault 管理模块
//! 处理 vault 目录结构、文件锁等

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

/// Vault 锁管理器
pub struct VaultLock {
    lock_file: PathBuf,
    _file: Option<fs::File>,
}

impl VaultLock {
    /// 尝试获取 vault 锁
    pub fn try_lock(vault_path: &Path) -> Result<Self, String> {
        let lock_file = vault_path.join(".zentri").join("lock");
        
        // 确保 .zentri 目录存在
        if let Some(parent) = lock_file.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create .zentri directory: {}", e))?;
        }

        // 尝试创建锁文件（独占模式）
        let file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&lock_file)
            .map_err(|e| {
                if e.kind() == io::ErrorKind::AlreadyExists {
                    format!("Vault is already locked. Another instance may be accessing this vault.")
                } else {
                    format!("Failed to create lock file: {}", e)
                }
            })?;

        // 写入进程 ID 到锁文件（用于调试）
        let pid = std::process::id();
        writeln!(&file, "{}", pid).map_err(|e| format!("Failed to write to lock file: {}", e))?;

        Ok(VaultLock {
            lock_file,
            _file: Some(file),
        })
    }

    /// 检查锁是否存在（不获取锁）
    pub fn is_locked(vault_path: &Path) -> bool {
        let lock_file = vault_path.join(".zentri").join("lock");
        lock_file.exists()
    }

    /// 释放锁（删除锁文件）
    pub fn unlock(&mut self) -> Result<(), String> {
        if self.lock_file.exists() {
            fs::remove_file(&self.lock_file)
                .map_err(|e| format!("Failed to remove lock file: {}", e))?;
        }
        self._file = None;
        Ok(())
    }
}

impl Drop for VaultLock {
    fn drop(&mut self) {
        // 自动清理锁文件
        let _ = self.unlock();
    }
}

/// 复制迁移文件到 vault
pub fn copy_migrations_to_vault(vault_path: &Path) -> Result<(), String> {
    let migrations_dir = vault_path.join(".zentri").join("migrations");
    fs::create_dir_all(&migrations_dir).map_err(|e| format!("Failed to create migrations directory: {}", e))?;

    // 迁移文件列表和内容
    let migrations_content = [
        ("001_initial_schema.sql", include_str!("../migrations/001_initial_schema.sql")),
        ("002_add_bookmarks.sql", include_str!("../migrations/002_add_bookmarks.sql")),
        ("002_add_highlight_type.sql", include_str!("../migrations/002_add_highlight_type.sql")),
        ("003_add_vectors.sql", include_str!("../migrations/003_add_vectors.sql")),
        ("004_add_cards.sql", include_str!("../migrations/004_add_cards.sql")),
    ];

    for (filename, content) in migrations_content.iter() {
        let dest_path = migrations_dir.join(filename);
        fs::write(&dest_path, content)
            .map_err(|e| format!("Failed to write migration file {}: {}", filename, e))?;
    }

    Ok(())
}

/// 获取数据库路径（相对于 vault）
pub fn get_database_path(vault_path: &Path) -> PathBuf {
    vault_path.join(".zentri").join("zentri.db")
}

/// 获取配置路径（相对于 vault）
pub fn get_config_path(vault_path: &Path) -> PathBuf {
    vault_path.join(".zentri").join("config.json")
}

