//! 资源文件管理命令
//! 处理图片等资源文件的上传、保存和管理

use crate::state::AppState;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;
use uuid::Uuid;

/// 保存图片文件到 vault 的 assets 目录
#[tauri::command]
pub fn save_image(
    state: State<AppState>,
    image_data: Vec<u8>,
    filename: String,
) -> Result<String, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault not initialized")?;

    // 创建 attachments/images 目录
    let images_dir = vault_path.join("attachments").join("images");
    if !images_dir.exists() {
        fs::create_dir_all(&images_dir).map_err(|e| format!("Failed to create images directory: {}", e))?;
    }

    // 生成唯一文件名（避免冲突）
    let file_ext = Path::new(&filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png");
    
    let unique_filename = format!("{}.{}", Uuid::new_v4(), file_ext);
    let file_path = images_dir.join(&unique_filename);

    // 保存文件
    fs::write(&file_path, image_data)
        .map_err(|e| format!("Failed to save image: {}", e))?;

    // 返回相对于 vault 的路径（用于存储和显示）
    let relative_path = file_path
        .strip_prefix(vault_path)
        .map_err(|e| format!("Failed to compute relative path: {}", e))?
        .to_string_lossy()
        .to_string();

    Ok(relative_path)
}

/// 读取图片文件
#[tauri::command]
pub fn read_image(
    state: State<AppState>,
    relative_path: String,
) -> Result<Vec<u8>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault not initialized")?;

    let file_path = vault_path.join(&relative_path);
    
    if !file_path.exists() {
        return Err(format!("Image file not found: {}", relative_path));
    }

    fs::read(&file_path)
        .map_err(|e| format!("Failed to read image: {}", e))
}

/// 删除图片文件
#[tauri::command]
pub fn delete_image(
    state: State<AppState>,
    relative_path: String,
) -> Result<(), String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault not initialized")?;

    let file_path = vault_path.join(&relative_path);
    
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete image: {}", e))?;
    }

    Ok(())
}

/// 读取本地文件（用于文件选择器选择的文件）
#[tauri::command]
pub fn read_local_file(path: String) -> Result<Vec<u8>, String> {
    let file_path = PathBuf::from(&path);
    
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// 保存电子书文件到 vault 的 assets 目录
#[tauri::command]
pub fn save_book_file(
    state: State<AppState>,
    source_path: String,
    filename: String,
) -> Result<String, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault not initialized")?;

    // 根据文件扩展名确定保存目录
    let file_ext = Path::new(&filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    let (sources_dir, subdir) = match file_ext.as_str() {
        "pdf" => ("sources", "pdf"),
        "epub" => ("sources", "epub"),
        _ => ("attachments", "files"),
    };
    
    let target_dir = vault_path.join(sources_dir).join(subdir);
    if !target_dir.exists() {
        fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create {} directory: {}", subdir, e))?;
    }

    // 生成唯一文件名（避免冲突）
    let unique_filename = format!("{}.{}", Uuid::new_v4(), file_ext);
    let dest_path = target_dir.join(&unique_filename);

    // 读取源文件
    let source_file = PathBuf::from(&source_path);
    if !source_file.exists() {
        return Err(format!("Source file not found: {}", source_path));
    }

    // 拷贝文件
    fs::copy(&source_file, &dest_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    // 返回相对于 vault 的路径（用于存储和显示）
    let relative_path = dest_path
        .strip_prefix(vault_path)
        .map_err(|e| format!("Failed to compute relative path: {}", e))?
        .to_string_lossy()
        .to_string();

    Ok(relative_path)
}

/// 获取文件流式读取的 URL（用于 foliate-js 等需要流式读取的库）
/// 返回一个可以通过 asset:// 协议访问的 URL
#[tauri::command]
pub fn get_book_file_url(
    state: State<AppState>,
    relative_path: String,
) -> Result<String, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault not initialized")?;

    let file_path = vault_path.join(&relative_path);
    
    if !file_path.exists() {
        return Err(format!("Book file not found: {}", relative_path));
    }

    // 返回绝对路径，前端可以使用 convertFileSrc 转换为 asset:// URL
    Ok(file_path.to_string_lossy().to_string())
}

/// 读取电子书文件（用于流式读取，但当前实现是一次性读取）
/// 注意：对于大文件，应该使用流式读取，但 Tauri 命令目前不支持流式返回
/// 可以考虑使用自定义 protocol handler 来实现真正的流式读取
#[tauri::command]
pub fn read_book_file(
    state: State<AppState>,
    relative_path: String,
) -> Result<Vec<u8>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("Vault not initialized")?;

    let file_path = vault_path.join(&relative_path);
    
    if !file_path.exists() {
        return Err(format!("Book file not found: {}", relative_path));
    }

    fs::read(&file_path)
        .map_err(|e| format!("Failed to read book file: {}", e))
}

