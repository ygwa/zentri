//! 数据存储模块
//! 使用纯 JSON 文件存储 Canvas 等非数据库数据

use std::fs;
use std::path::Path;

/// Canvas 目录名称
const DIR_CANVASES: &str = "40_Canvases";

/// 生成短 ID (类似 nanoid)
fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let random: u32 = rand::random();
    format!("{:x}{:x}", (timestamp % 0xFFFFFF) as u32, random % 0xFFFF)
}

/// 确保新的 vault 目录结构存在
pub fn ensure_vault_structure(vault_path: &Path) -> Result<(), String> {
    // 创建 .zentri 目录及其子目录
    let zentri_dir = vault_path.join(".zentri");
    fs::create_dir_all(&zentri_dir).map_err(|e| e.to_string())?;
    
    // 创建 migrations 目录
    let migrations_dir = zentri_dir.join("migrations");
    fs::create_dir_all(&migrations_dir).map_err(|e| e.to_string())?;

    // 创建 sources 目录及其子目录
    for dir in ["pdf", "epub", "web"] {
        let path = vault_path.join("sources").join(dir);
        if !path.exists() {
            fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        }
    }

    // 创建 attachments 目录及其子目录
    for dir in ["images", "files"] {
        let path = vault_path.join("attachments").join(dir);
        if !path.exists() {
            fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        }
    }

    // 创建 derived 目录及其子目录
    for dir in ["embeddings", "ocr", "thumbnails"] {
        let path = vault_path.join("derived").join(dir);
        if !path.exists() {
            fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        }
    }

    // 注意：vault 下不再创建 config.json，配置存储在 app_data 目录下
    // 数据库文件 zentri.db 会在 Database::open 时自动创建

    Ok(())
}

/// 确保存储目录结构存在（向后兼容，保留旧结构支持）
pub fn ensure_storage_dirs(data_path: &Path) -> Result<(), String> {
    // 创建其他目录
    for dir in ["sources", "files", "highlights", "canvases"] {
        let path = data_path.join(dir);
        if !path.exists() {
            fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        }
    }

    // 专门为 Canvases 创建
    let canvas_path = data_path.join("canvases").join(DIR_CANVASES);
    if !canvas_path.exists() {
        fs::create_dir_all(&canvas_path).map_err(|e| e.to_string())?;
    }

    // 确保 config.json 存在（旧位置，用于向后兼容）
    let config_path = data_path.join("config.json");
    if !config_path.exists() {
        let config = serde_json::json!({
            "version": 1,
            "dataVersion": "2.0.0",
            "createdAt": current_timestamp(),
            "settings": {
                "defaultCardType": "fleeting",
                "autoSaveInterval": 5000
            }
        });
        let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        fs::write(&config_path, content).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 获取当前时间戳
pub(crate) fn current_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

// -----------------------------------------------------------------------------
// Canvas Operations
// -----------------------------------------------------------------------------
use crate::models::canvas::{Canvas, CanvasListItem};

/// 读取所有 Canvas
pub fn read_all_canvases(data_path: &Path) -> Vec<CanvasListItem> {
    let mut canvases = Vec::new();
    let dir_path = data_path.join("canvases").join(DIR_CANVASES);

    if !dir_path.exists() {
        return canvases;
    }

    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(canvas) = serde_json::from_str::<Canvas>(&content) {
                        canvases.push(canvas.into());
                    }
                }
            }
        }
    }

    canvases.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    canvases
}

/// 读取单个 Canvas
pub fn read_canvas(data_path: &Path, id: &str) -> Option<Canvas> {
    let path = data_path
        .join("canvases")
        .join(DIR_CANVASES)
        .join(format!("{}.json", id));

    if path.exists() {
        if let Ok(content) = fs::read_to_string(path) {
            return serde_json::from_str(&content).ok();
        }
    }
    None
}

/// 创建 Canvas
pub fn create_canvas(data_path: &Path, title: &str) -> Result<Canvas, String> {
    let id = generate_id();
    let now = current_timestamp();

    let canvas = Canvas {
        id: id.clone(),
        title: title.to_string(),
        nodes: serde_json::json!([]),
        edges: serde_json::json!([]),
        created_at: now,
        updated_at: now,
    };

    let dir_path = data_path.join("canvases").join(DIR_CANVASES);
    if !dir_path.exists() {
        fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
    }

    let path = dir_path.join(format!("{}.json", id));
    let content = serde_json::to_string_pretty(&canvas).map_err(|e| e.to_string())?;

    fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(canvas)
}

/// 更新 Canvas
pub fn update_canvas(
    data_path: &Path,
    id: &str,
    title: Option<String>,
    nodes: Option<serde_json::Value>,
    edges: Option<serde_json::Value>,
) -> Result<Canvas, String> {
    let mut canvas = read_canvas(data_path, id).ok_or("Canvas not found")?;

    if let Some(t) = title {
        canvas.title = t;
    }
    if let Some(n) = nodes {
        canvas.nodes = n;
    }
    if let Some(e) = edges {
        canvas.edges = e;
    }

    canvas.updated_at = current_timestamp();

    let dir_path = data_path.join("canvases").join(DIR_CANVASES);
    let path = dir_path.join(format!("{}.json", id));
    let content = serde_json::to_string_pretty(&canvas).map_err(|e| e.to_string())?;

    fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(canvas)
}

/// 删除 Canvas
pub fn delete_canvas(data_path: &Path, id: &str) -> Result<(), String> {
    let path = data_path
        .join("canvases")
        .join(DIR_CANVASES)
        .join(format!("{}.json", id));

    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Card 相关函数已全部移除，Card 现在存储在数据库中
