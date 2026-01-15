//! WebSnapshot 数据访问层

use crate::db::Database;
use crate::error::AppResult;
use crate::web_reader::WebSnapshot;
use std::fs;
use std::sync::Arc;

/// WebSnapshot 数据访问层
pub struct WebSnapshotRepository {
    db: Arc<Database>,
    vault_path: Option<std::path::PathBuf>,
}

impl WebSnapshotRepository {
    pub fn new(db: Arc<Database>, vault_path: Option<std::path::PathBuf>) -> Self {
        Self { db, vault_path }
    }

    /// 保存网页快照（内容保存到文件系统，元数据保存到数据库）
    pub async fn save(&self, snapshot: &WebSnapshot) -> AppResult<()> {
        // 如果有 vault_path，保存 HTML 内容到文件系统
        if let Some(ref vault_path) = self.vault_path {
            let web_dir = vault_path.join("sources").join("web");
            fs::create_dir_all(&web_dir).map_err(|e| crate::error::AppError::Io(e))?;
            
            let html_file = web_dir.join(format!("{}.html", snapshot.source_id));
            fs::write(&html_file, &snapshot.content)
                .map_err(|e| crate::error::AppError::Io(e))?;
        }

        // 保存元数据到数据库（不包含 content，只保存文件路径引用）
        self.db.save_web_snapshot_metadata(snapshot).await
    }

    /// 获取网页快照（从文件系统读取内容）
    pub async fn get_by_source(&self, source_id: &str) -> AppResult<Option<WebSnapshot>> {
        // 从数据库获取元数据
        let mut snapshot = self.db.get_web_snapshot_metadata(source_id).await?;
        
        if let Some(ref mut snap) = snapshot {
            // 从文件系统读取 HTML 内容
            if let Some(ref vault_path) = self.vault_path {
                let html_file = vault_path.join("sources").join("web").join(format!("{}.html", source_id));
                if html_file.exists() {
                    snap.content = fs::read_to_string(&html_file)
                        .map_err(|e| crate::error::AppError::Io(e))?;
                    // text_content 可以从 content 重新生成，或从单独的文件读取
                    // 这里为了简化，我们假设 text_content 也在数据库中（向后兼容）
                }
            }
        }
        
        Ok(snapshot)
    }

    /// 删除网页快照
    #[allow(dead_code)]
    pub async fn delete(&self, source_id: &str) -> AppResult<()> {
        // 删除文件系统中的 HTML 文件
        if let Some(ref vault_path) = self.vault_path {
            let html_file = vault_path.join("sources").join("web").join(format!("{}.html", source_id));
            if html_file.exists() {
                fs::remove_file(&html_file).ok(); // 忽略错误，可能已经被删除
            }
        }
        
        // 删除数据库中的元数据
        self.db.delete_web_snapshot(source_id).await
    }
}

impl crate::database::Repository for WebSnapshotRepository {
    fn db(&self) -> &Arc<Database> {
        &self.db
    }
}

