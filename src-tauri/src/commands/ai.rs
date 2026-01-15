//! AI 相关命令
//! 提供 AI 服务器管理、模型管理、聊天和 RAG 功能

use crate::ai::{ModelInfo, get_available_models, sidecar::CommandEvent};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String, // "user", "assistant", "system"
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub model_path: Option<String>,
}

/// 启动 AI 服务器
#[tauri::command]
pub async fn ai_start_server(
    state: State<'_, AppState>,
    modelId: String,
    port: Option<u16>,
) -> Result<u16, String> {
    let ai_manager = state
        .ai_manager
        .lock()
        .unwrap()
        .as_ref()
        .ok_or("AI manager not initialized")?
        .clone();

    let model_manager = ai_manager.get_models();
    let model_path = model_manager.get_model_path(&modelId);
    
    if !model_path.exists() {
        return Err(format!("Model not found: {}", modelId));
    }

    let sidecar = ai_manager.get_sidecar();
    let (mut event_rx, actual_port) = sidecar
        .start(model_path, port)
        .await
        .map_err(|e| e.to_string())?;

    ai_manager.set_port(actual_port);
    
    // 等待一小段时间让服务器启动，然后验证它真的在运行
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    
    // 验证进程是否还在运行
    if !sidecar.is_running().await {
        // 收集错误输出（非阻塞方式）
        let mut error_messages = Vec::new();
        loop {
            match event_rx.try_recv() {
                Ok(event) => {
                    match event {
                        CommandEvent::Stderr(msg) => {
                            error_messages.push(format!("[stderr] {}", msg));
                        }
                        CommandEvent::Stdout(msg) => {
                            error_messages.push(format!("[stdout] {}", msg));
                        }
                        CommandEvent::Terminated { code } => {
                            error_messages.push(format!("[exit] Process exited with code: {:?}", code));
                        }
                    }
                }
                Err(tokio::sync::mpsc::error::TryRecvError::Empty) => {
                    break; // 没有更多消息
                }
                Err(tokio::sync::mpsc::error::TryRecvError::Disconnected) => {
                    break; // 通道已关闭
                }
            }
        }
        
        let error_detail = if error_messages.is_empty() {
            "No error output captured. The process may have exited before producing any output.".to_string()
        } else {
            error_messages.join("\n")
        };
        
        return Err(format!(
            "Server process exited immediately after startup.\nError details:\n{}",
            error_detail
        ));
    }
    
    Ok(actual_port)
}

/// 停止 AI 服务器
#[tauri::command]
pub async fn ai_stop_server(state: State<'_, AppState>) -> Result<(), String> {
    let ai_manager = state
        .ai_manager
        .lock()
        .unwrap()
        .as_ref()
        .ok_or("AI manager not initialized")?
        .clone();

    let sidecar = ai_manager.get_sidecar();
    sidecar.stop().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// 检查服务器状态
#[tauri::command]
pub async fn ai_check_status(state: State<'_, AppState>) -> Result<ServerStatus, String> {
    let ai_manager = state
        .ai_manager
        .lock()
        .unwrap()
        .as_ref()
        .ok_or("AI manager not initialized")?
        .clone();

    let sidecar = ai_manager.get_sidecar();
    let port = ai_manager.get_port();
    let is_process_running = sidecar.is_running().await;
    let model_path = sidecar.get_model_path().await.map(|p| p.to_string_lossy().to_string());
    
    // 如果进程在运行，进一步检查健康状态
    let running = if is_process_running {
        // 给服务器一点时间启动，然后检查健康状态
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        sidecar.check_health(port).await || is_process_running
    } else {
        false
    };

    Ok(ServerStatus {
        running,
        port,
        model_path,
    })
}

/// 列出可用模型
#[tauri::command]
pub fn ai_list_models(_state: State<'_, AppState>) -> Result<Vec<ModelInfo>, String> {
    Ok(get_available_models())
}

/// 列出已下载的模型
#[tauri::command]
pub fn ai_list_downloaded_models(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let ai_manager = state
        .ai_manager
        .lock()
        .unwrap()
        .as_ref()
        .ok_or("AI manager not initialized")?
        .clone();

    let model_manager = ai_manager.get_models();
    model_manager.list_downloaded_models().map_err(|e| e.to_string())
}

/// 下载模型
#[tauri::command]
pub async fn ai_download_model(
    state: State<'_, AppState>,
    modelId: String,
) -> Result<String, String> {
    let ai_manager = state
        .ai_manager
        .lock()
        .unwrap()
        .as_ref()
        .ok_or("AI manager not initialized")?
        .clone();

    let model_manager = ai_manager.get_models();
    
    // 查找模型信息
    let model_info = get_available_models()
        .into_iter()
        .find(|m| m.id == modelId)
        .ok_or_else(|| format!("Model not found: {}", modelId))?;

    // 下载模型
    let model_path = model_manager
        .download_model(&model_info, None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(model_path.to_string_lossy().to_string())
}

/// 设置活动模型
#[tauri::command]
pub fn ai_set_active_model(
    _state: State<'_, AppState>,
    modelPath: String,
) -> Result<(), String> {
    // 这个功能主要是验证模型路径，实际使用在启动服务器时
    let path = PathBuf::from(&modelPath);
    if !path.exists() {
        return Err(format!("Model file not found: {}", modelPath));
    }
    Ok(())
}

/// 基础聊天功能（通过 HTTP 调用 llama-server）
#[tauri::command]
pub async fn ai_chat(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    let ai_manager = state
        .ai_manager
        .lock()
        .unwrap()
        .as_ref()
        .ok_or("AI manager not initialized")?
        .clone();

    let port = ai_manager.get_port();
    let sidecar = ai_manager.get_sidecar();
    
    if !sidecar.is_running().await {
        return Err("AI server is not running".to_string());
    }

    // 调用 llama-server 的 OpenAI 兼容 API
    let client = reqwest::Client::new();
    let url = format!("http://127.0.0.1:{}/v1/chat/completions", port);

    #[derive(Serialize)]
    struct ChatRequest {
        model: String,
        messages: Vec<ChatMessage>,
        stream: bool,
    }

    let request = ChatRequest {
        model: "local-model".to_string(),
        messages,
        stream: false,
    };

    #[derive(Deserialize)]
    struct ChatResponse {
        choices: Vec<ChatChoice>,
    }

    #[derive(Deserialize)]
    struct ChatChoice {
        message: ChatMessage,
    }

    let response: ChatResponse = client
        .post(&url)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(response.choices[0].message.content.clone())
}

/// 即时解释功能
#[tauri::command]
pub async fn ai_explain_text(
    state: State<'_, AppState>,
    text: String,
    context: Option<String>,
) -> Result<String, String> {
    let mut prompt = format!(
        "你是一个学术助手。请解释以下这段话，必须基于上下文。\n\n待解释文本：{}\n\n",
        text
    );

    if let Some(ctx) = context {
        prompt.push_str(&format!("上下文：{}\n\n", ctx));
    }

    prompt.push_str("请提供清晰、详细的解释。");

    let messages = vec![ChatMessage {
        role: "user".to_string(),
        content: prompt,
    }];

    ai_chat(state, messages).await
}

/// RAG 查询
#[tauri::command]
pub async fn ai_rag_query(
    state: State<'_, AppState>,
    query: String,
    sourceId: Option<String>,
) -> Result<String, String> {
    let ai_manager = state
        .ai_manager
        .lock()
        .unwrap()
        .as_ref()
        .ok_or("AI manager not initialized")?
        .clone();

    let rag = ai_manager.get_rag();
    
    // 搜索相似内容
    let search_results = rag
        .search_similar(&query, 5, sourceId.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    // 构建 RAG Prompt（使用关联函数语法）
    use crate::ai::rag::RAGService;
    let prompt = RAGService::build_rag_prompt(&query, search_results);

    // 调用聊天 API
    let messages = vec![ChatMessage {
        role: "user".to_string(),
        content: prompt,
    }];

    ai_chat(state, messages).await
}

/// 索引文献源（用于 RAG）
#[tauri::command]
pub async fn ai_index_source(
    state: State<'_, AppState>,
    sourceId: String,
    content: String,
) -> Result<(), String> {
    let ai_manager = state
        .ai_manager
        .lock()
        .unwrap()
        .as_ref()
        .ok_or("AI manager not initialized")?
        .clone();

    let rag = ai_manager.get_rag();
    rag.index_source(&sourceId, &content)
        .await
        .map_err(|e| e.to_string())
}

