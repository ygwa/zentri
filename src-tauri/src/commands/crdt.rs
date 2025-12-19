//! CRDT 相关命令
//! 提供协作编辑、历史快照等功能的前端 API

use crate::crdt::HistorySnapshot;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// 同步响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResponse {
    /// 增量更新数据 (base64 编码)
    pub update: String,
    /// 状态向量 (base64 编码)
    pub state_vector: String,
}

/// 快照信息 (传给前端)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotInfo {
    pub id: String,
    pub timestamp: i64,
    pub description: Option<String>,
}

impl From<HistorySnapshot> for SnapshotInfo {
    fn from(s: HistorySnapshot) -> Self {
        Self {
            id: s.id,
            timestamp: s.timestamp,
            description: s.description,
        }
    }
}

/// 获取文档的完整 CRDT 状态
#[tauri::command]
pub fn crdt_get_state(state: State<AppState>, doc_id: String) -> Result<String, String> {
    let crdt_guard = state.crdt.lock().unwrap();
    let crdt = crdt_guard.as_ref().ok_or("CRDT manager not initialized")?;

    let full_state = crdt.get_full_state(&doc_id);
    Ok(base64_encode(&full_state))
}

/// 获取状态向量 (用于增量同步)
#[tauri::command]
pub fn crdt_get_state_vector(state: State<AppState>, doc_id: String) -> Result<String, String> {
    let crdt_guard = state.crdt.lock().unwrap();
    let crdt = crdt_guard.as_ref().ok_or("CRDT manager not initialized")?;

    let sv = crdt.get_state_vector(&doc_id);
    Ok(base64_encode(&sv))
}

/// 应用来自前端的更新
#[tauri::command]
pub fn crdt_apply_update(
    state: State<AppState>,
    doc_id: String,
    update: String,
) -> Result<(), String> {
    let crdt_guard = state.crdt.lock().unwrap();
    let crdt = crdt_guard.as_ref().ok_or("CRDT manager not initialized")?;

    let update_bytes = base64_decode(&update)?;
    crdt.apply_update(&doc_id, &update_bytes)
}

/// 获取增量更新 (从给定状态向量)
#[tauri::command]
pub fn crdt_get_diff(
    state: State<AppState>,
    doc_id: String,
    state_vector: String,
) -> Result<String, String> {
    let crdt_guard = state.crdt.lock().unwrap();
    let crdt = crdt_guard.as_ref().ok_or("CRDT manager not initialized")?;

    let sv_bytes = base64_decode(&state_vector)?;
    let diff = crdt.get_diff(&doc_id, &sv_bytes)?;
    Ok(base64_encode(&diff))
}

/// 同步文档 (双向)
/// 前端发送自己的状态向量和更新，后端返回缺失的更新
#[tauri::command]
pub fn crdt_sync(
    state: State<AppState>,
    doc_id: String,
    client_state_vector: String,
    client_update: Option<String>,
) -> Result<SyncResponse, String> {
    let crdt_guard = state.crdt.lock().unwrap();
    let crdt = crdt_guard.as_ref().ok_or("CRDT manager not initialized")?;

    // 1. 如果客户端有更新，先应用
    if let Some(update) = client_update {
        let update_bytes = base64_decode(&update)?;
        crdt.apply_update(&doc_id, &update_bytes)?;
    }

    // 2. 计算服务端需要发送给客户端的更新
    let client_sv = base64_decode(&client_state_vector)?;
    let server_update = crdt.get_diff(&doc_id, &client_sv)?;

    // 3. 返回服务端的状态向量和更新
    let server_sv = crdt.get_state_vector(&doc_id);

    Ok(SyncResponse {
        update: base64_encode(&server_update),
        state_vector: base64_encode(&server_sv),
    })
}

/// 保存文档到磁盘
#[tauri::command]
pub fn crdt_save(state: State<AppState>, doc_id: String) -> Result<(), String> {
    let crdt_guard = state.crdt.lock().unwrap();
    let crdt = crdt_guard.as_ref().ok_or("CRDT manager not initialized")?;

    crdt.save_to_disk(&doc_id)
}

/// 保存所有脏文档
#[tauri::command]
pub fn crdt_flush_all(state: State<AppState>) -> Result<usize, String> {
    let crdt_guard = state.crdt.lock().unwrap();
    let crdt = crdt_guard.as_ref().ok_or("CRDT manager not initialized")?;

    crdt.flush_all()
}

/// 创建历史快照
#[tauri::command]
pub fn crdt_create_snapshot(
    state: State<AppState>,
    doc_id: String,
    description: Option<String>,
) -> Result<SnapshotInfo, String> {
    let crdt_guard = state.crdt.lock().unwrap();
    let crdt = crdt_guard.as_ref().ok_or("CRDT manager not initialized")?;

    let snapshot = crdt.create_snapshot(&doc_id, description.as_deref())?;
    Ok(snapshot.into())
}

/// 获取快照列表
#[tauri::command]
pub fn crdt_list_snapshots(state: State<AppState>, doc_id: String) -> Result<Vec<SnapshotInfo>, String> {
    let crdt_guard = state.crdt.lock().unwrap();
    let crdt = crdt_guard.as_ref().ok_or("CRDT manager not initialized")?;

    let snapshots = crdt.list_snapshots(&doc_id);
    Ok(snapshots.into_iter().map(|s| s.into()).collect())
}

/// 恢复到指定快照
#[tauri::command]
pub fn crdt_restore_snapshot(
    state: State<AppState>,
    doc_id: String,
    snapshot_timestamp: i64,
) -> Result<String, String> {
    let crdt_guard = state.crdt.lock().unwrap();
    let crdt = crdt_guard.as_ref().ok_or("CRDT manager not initialized")?;

    crdt.restore_snapshot(&doc_id, snapshot_timestamp)?;
    
    // 返回恢复后的完整状态
    let full_state = crdt.get_full_state(&doc_id);
    Ok(base64_encode(&full_state))
}

/// 卸载文档 (释放内存)
#[tauri::command]
pub fn crdt_unload(state: State<AppState>, doc_id: String) -> Result<(), String> {
    let crdt_guard = state.crdt.lock().unwrap();
    let crdt = crdt_guard.as_ref().ok_or("CRDT manager not initialized")?;

    // 先保存
    crdt.save_to_disk(&doc_id)?;
    // 再卸载
    crdt.unload(&doc_id);
    Ok(())
}

// ============ 辅助函数 ============

fn base64_encode(data: &[u8]) -> String {
    use std::io::Write;
    let mut encoder = base64_encoder();
    encoder.write_all(data).unwrap();
    encoder.into_inner()
}

fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    // 简单的 base64 解码实现
    let table = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = Vec::new();
    let mut buffer: u32 = 0;
    let mut bits_collected = 0;

    for c in s.bytes() {
        if c == b'=' {
            break;
        }
        let value = table.iter().position(|&x| x == c);
        if let Some(v) = value {
            buffer = (buffer << 6) | (v as u32);
            bits_collected += 6;
            if bits_collected >= 8 {
                bits_collected -= 8;
                result.push((buffer >> bits_collected) as u8);
                buffer &= (1 << bits_collected) - 1;
            }
        }
    }
    Ok(result)
}

struct Base64Encoder {
    output: String,
    buffer: u32,
    bits: u8,
}

fn base64_encoder() -> Base64Encoder {
    Base64Encoder {
        output: String::new(),
        buffer: 0,
        bits: 0,
    }
}

impl std::io::Write for Base64Encoder {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        for &byte in buf {
            self.buffer = (self.buffer << 8) | (byte as u32);
            self.bits += 8;
            while self.bits >= 6 {
                self.bits -= 6;
                let idx = ((self.buffer >> self.bits) & 0x3F) as usize;
                self.output.push(TABLE[idx] as char);
            }
        }
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Base64Encoder {
    fn into_inner(mut self) -> String {
        const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        if self.bits > 0 {
            self.buffer <<= 6 - self.bits;
            let idx = (self.buffer & 0x3F) as usize;
            self.output.push(TABLE[idx] as char);
            let padding = (4 - (self.output.len() % 4)) % 4;
            for _ in 0..padding {
                self.output.push('=');
            }
        }
        self.output
    }
}



