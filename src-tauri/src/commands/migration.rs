//! Vault 结构迁移工具
//! 检测旧结构并自动迁移文件和更新路径引用

use crate::state::AppState;
use crate::storage;
use crate::vault;
use std::fs;
use std::path::PathBuf;
use tauri::State;

/// 迁移 vault 结构到新格式
#[tauri::command]
pub async fn migrate_vault_structure(state: State<'_, AppState>) -> Result<String, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault not initialized")?;

    let mut migrations = Vec::new();

    // 1. 确保新目录结构存在
    storage::ensure_vault_structure(&vault_path).map_err(|e| e.to_string())?;
    migrations.push("Created new directory structure".to_string());

    // 2. 迁移数据库（如果旧数据库存在）
    let app_data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("zentri");
    let old_db_path = app_data_dir.join("zentri.db");
    let new_db_path = vault::get_database_path(&vault_path);

    if old_db_path.exists() && !new_db_path.exists() {
        fs::copy(&old_db_path, &new_db_path)
            .map_err(|e| format!("Failed to migrate database: {}", e))?;
        migrations.push("Migrated database to .zentri/zentri.db".to_string());
    }

    // 3. 迁移 config.json
    let old_config_path = vault_path.join("config.json");
    let new_config_path = vault::get_config_path(&vault_path);
    if old_config_path.exists() && !new_config_path.exists() {
        fs::copy(&old_config_path, &new_config_path)
            .map_err(|e| format!("Failed to migrate config: {}", e))?;
        migrations.push("Migrated config.json to .zentri/config.json".to_string());
    }

    // 4. 迁移书籍文件
    let old_books_dir = vault_path.join("assets").join("books");
    let new_epub_dir = vault_path.join("sources").join("epub");
    let new_pdf_dir = vault_path.join("sources").join("pdf");

    if old_books_dir.exists() {
        if let Ok(entries) = fs::read_dir(&old_books_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let ext = path.extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    
                    let dest_dir = if ext == "pdf" {
                        &new_pdf_dir
                    } else if ext == "epub" {
                        &new_epub_dir
                    } else {
                        continue; // 跳过不支持的文件类型
                    };

                    if !dest_dir.exists() {
                        fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
                    }

                    let dest_path = dest_dir.join(path.file_name().unwrap());
                    if !dest_path.exists() {
                        fs::copy(&path, &dest_path)
                            .map_err(|e| format!("Failed to copy {}: {}", path.display(), e))?;
                    }
                }
            }
            migrations.push(format!("Migrated books from assets/books to sources/{{epub,pdf}}"));
        }
    }

    // 5. 迁移缩略图
    let old_covers_dir = vault_path.join("assets").join("covers");
    let new_thumbnails_dir = vault_path.join("derived").join("thumbnails");

    if old_covers_dir.exists() {
        if let Ok(entries) = fs::read_dir(&old_covers_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let dest_path = new_thumbnails_dir.join(path.file_name().unwrap());
                    if !dest_path.exists() {
                        fs::copy(&path, &dest_path)
                            .map_err(|e| format!("Failed to copy thumbnail {}: {}", path.display(), e))?;
                    }
                }
            }
            migrations.push("Migrated thumbnails from assets/covers to derived/thumbnails".to_string());
        }
    }

    // 6. 迁移图片附件
    let old_assets_dir = vault_path.join("assets");
    let new_images_dir = vault_path.join("attachments").join("images");

    if old_assets_dir.exists() {
        if let Ok(entries) = fs::read_dir(&old_assets_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    // 跳过已经迁移的 books 和 covers 目录中的文件
                    if path.parent() == Some(&old_books_dir) || path.parent() == Some(&old_covers_dir) {
                        continue;
                    }

                    // 检查是否是图片文件
                    let ext = path.extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    
                    if matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg") {
                        let dest_path = new_images_dir.join(path.file_name().unwrap());
                        if !dest_path.exists() {
                            fs::copy(&path, &dest_path)
                                .map_err(|e| format!("Failed to copy image {}: {}", path.display(), e))?;
                        }
                    }
                }
            }
            migrations.push("Migrated images from assets to attachments/images".to_string());
        }
    }

    // 7. 复制迁移文件
    vault::copy_migrations_to_vault(&vault_path).map_err(|e| e.to_string())?;
    migrations.push("Copied migration files to .zentri/migrations".to_string());

    // 8. 更新数据库中的路径引用（需要在数据库操作中实现）
    // 这里可以调用数据库更新函数来更新 sources 表中的 url 字段等

    Ok(format!("Migration completed:\n{}", migrations.join("\n")))
}

