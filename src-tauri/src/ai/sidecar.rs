//! Sidecar 进程管理
//! 负责启动、停止和监控 llama-server 进程

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tokio::process::Command as TokioCommand;
use tokio::io::{AsyncBufReadExt, BufReader};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SidecarError {
    #[error("Failed to create sidecar command: {0}")]
    CommandCreation(String),
    #[error("Failed to spawn sidecar: {0}")]
    Spawn(String),
    #[error("Sidecar process not running")]
    NotRunning,
    #[error("Port {0} is already in use")]
    PortInUse(u16),
}

#[derive(Debug, Clone)]
pub enum CommandEvent {
    Stdout(String),
    Stderr(String),
    Terminated { code: Option<i32> },
}

/// Sidecar 管理器
pub struct SidecarManager {
    child: Arc<Mutex<Option<tokio::process::Child>>>,
    port: Arc<Mutex<u16>>,
    model_path: Arc<Mutex<Option<PathBuf>>>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            port: Arc::new(Mutex::new(8080)),
            model_path: Arc::new(Mutex::new(None)),
        }
    }

    /// 检查端口是否可用
    fn check_port_available(port: u16) -> bool {
        use std::net::TcpListener;
        TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
    }

    /// 查找可用端口
    fn find_available_port(start: u16) -> u16 {
        for port in start..(start + 100) {
            if Self::check_port_available(port) {
                return port;
            }
        }
        start // 如果找不到，返回起始端口（可能会失败）
    }

    /// 获取 sidecar 二进制路径
    fn get_sidecar_path() -> Result<PathBuf, SidecarError> {
        // 在开发模式下，尝试从 src-tauri 目录查找
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                // 尝试在可执行文件目录查找
                let sidecar_name = if cfg!(target_os = "windows") {
                    "llama-server.exe"
                } else {
                    "llama-server"
                };
                let sidecar_path = exe_dir.join(sidecar_name);
                if sidecar_path.exists() {
                    return Ok(sidecar_path);
                }
            }
        }

        // 尝试从当前工作目录查找（开发模式）
        let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let src_tauri_dir = current_dir.join("src-tauri");
        
        // 首先尝试查找带平台后缀的文件名（如 llama-server-aarch64-apple-darwin）
        let platform_suffix = if cfg!(target_os = "macos") {
            if cfg!(target_arch = "aarch64") {
                "aarch64-apple-darwin"
            } else {
                "x86_64-apple-darwin"
            }
        } else if cfg!(target_os = "linux") {
            if cfg!(target_arch = "aarch64") {
                "aarch64-unknown-linux-gnu"
            } else {
                "x86_64-unknown-linux-gnu"
            }
        } else if cfg!(target_os = "windows") {
            if cfg!(target_arch = "aarch64") {
                "aarch64-pc-windows-msvc.exe"
            } else {
                "x86_64-pc-windows-msvc.exe"
            }
        } else {
            ""
        };
        
        if !platform_suffix.is_empty() {
            let sidecar_name = format!("llama-server-{}", platform_suffix);
            let sidecar_path = src_tauri_dir.join(&sidecar_name);
            if sidecar_path.exists() {
                return Ok(sidecar_path);
            }
        }
        
        // 回退到标准名称
        let sidecar_name = if cfg!(target_os = "windows") {
            "llama-server.exe"
        } else {
            "llama-server"
        };
        let sidecar_path = src_tauri_dir.join(sidecar_name);
        if sidecar_path.exists() {
            return Ok(sidecar_path);
        }

        Err(SidecarError::CommandCreation(
            format!("llama-server binary not found. Please ensure it is in src-tauri/ directory. Tried: {}", 
                src_tauri_dir.display())
        ))
    }

    /// 启动 llama-server sidecar
    pub async fn start(
        &self,
        model_path: PathBuf,
        port: Option<u16>,
    ) -> Result<(mpsc::Receiver<CommandEvent>, u16), SidecarError> {
        // 检查是否已经在运行
        if self.is_running().await {
            return Err(SidecarError::Spawn("Sidecar is already running".to_string()));
        }

        // 确定端口
        let preferred_port = *self.port.lock().await;
        let actual_port = port.unwrap_or_else(|| {
            Self::find_available_port(preferred_port)
        });

        // 验证模型文件存在
        if !model_path.exists() {
            return Err(SidecarError::Spawn(format!(
                "Model file not found: {}",
                model_path.display()
            )));
        }

        // 获取 sidecar 路径
        let sidecar_path = Self::get_sidecar_path()?;
        
        // 在 macOS 上，@rpath 设置为 @loader_path，需要库文件在同一目录
        // 检查必要的库文件是否存在
        #[cfg(target_os = "macos")]
        {
            let sidecar_dir = sidecar_path.parent()
                .ok_or_else(|| SidecarError::CommandCreation("Invalid sidecar path".to_string()))?;
            
            let required_libs = [
                "libmtmd.0.dylib",
                "libllama.0.dylib",
                "libggml.0.dylib",
                "libggml-cpu.0.dylib",
                "libggml-blas.0.dylib",
                "libggml-metal.0.dylib",
                "libggml-rpc.0.dylib",
                "libggml-base.0.dylib",
            ];
            
            let missing_libs: Vec<&str> = required_libs
                .iter()
                .filter(|lib| !sidecar_dir.join(lib).exists())
                .copied()
                .collect();
            
            if !missing_libs.is_empty() {
                return Err(SidecarError::CommandCreation(format!(
                    "Required dynamic libraries not found in {}: {}. \
                    Please ensure all .dylib files are in the same directory as llama-server.",
                    sidecar_dir.display(),
                    missing_libs.join(", ")
                )));
            }
        }

        // 创建事件通道
        let (tx, rx) = mpsc::channel(100);

        // 使用 tokio::process::Command 以便异步处理 I/O
        let mut cmd = TokioCommand::new(&sidecar_path);
        cmd.args([
            "--model",
            model_path.to_str().ok_or_else(|| {
                SidecarError::CommandCreation("Invalid model path".to_string())
            })?,
            "--port",
            &actual_port.to_string(),
            "--host",
            "127.0.0.1",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

        // 启动进程
        let mut child = cmd
            .spawn()
            .map_err(|e| SidecarError::Spawn(format!("Failed to spawn llama-server: {}", e)))?;

        // 获取 stdout 和 stderr
        let stdout = child.stdout.take().ok_or_else(|| {
            SidecarError::Spawn("Failed to capture stdout".to_string())
        })?;
        let stderr = child.stderr.take().ok_or_else(|| {
            SidecarError::Spawn("Failed to capture stderr".to_string())
        })?;

        // 存储进程和模型路径
        {
            let mut child_guard = self.child.lock().await;
            *child_guard = Some(child);
        }
        {
            let mut path_guard = self.model_path.lock().await;
            *path_guard = Some(model_path);
        }
        {
            let mut port_guard = self.port.lock().await;
            *port_guard = actual_port;
        }

        // 异步监听进程输出
        let tx_stdout = tx.clone();
        let tx_stderr = tx.clone();

        // 监听 stdout
        tauri::async_runtime::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = tx_stdout.send(CommandEvent::Stdout(line)).await;
            }
        });

        // 监听 stderr
        tauri::async_runtime::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = tx_stderr.send(CommandEvent::Stderr(line)).await;
            }
        });

        // 监听进程终止（不立即 take，而是等待进程退出后再清理）
        let child_clone2 = self.child.clone();
        let tx_term = tx.clone();
        tauri::async_runtime::spawn(async move {
            // 等待进程退出（不立即 take，保持 child 在 self.child 中）
            loop {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                let mut child_guard = child_clone2.lock().await;
                if let Some(child) = child_guard.as_mut() {
                    if let Ok(Some(exit_status)) = child.try_wait() {
                        // 进程已退出，清理并发送事件
                        let code = exit_status.code();
                        child_guard.take(); // 现在才清理
                        let _ = tx_term.send(CommandEvent::Terminated { code }).await;
                        break;
                    }
                } else {
                    // child 已被移除，退出循环
                    break;
                }
            }
        });

        Ok((rx, actual_port))
    }

    /// 停止 sidecar 进程
    pub async fn stop(&self) -> Result<(), SidecarError> {
        let mut child_guard = self.child.lock().await;
        if let Some(mut child) = child_guard.take() {
            child.kill().await.map_err(|e| SidecarError::Spawn(e.to_string()))
        } else {
            Err(SidecarError::NotRunning)
        }
    }

    /// 检查 sidecar 是否正在运行
    pub async fn is_running(&self) -> bool {
        let mut child_guard = self.child.lock().await;
        if let Some(child) = child_guard.as_mut() {
            // 尝试获取退出状态，如果进程已退出会返回 Some
            // tokio::process::Child 的 try_wait 返回 Option<ExitStatus>
            if let Some(_) = child.try_wait().ok().flatten() {
                false // 进程已退出
            } else {
                true // 进程仍在运行
            }
        } else {
            false
        }
    }

    /// 获取当前使用的端口
    pub async fn get_port(&self) -> u16 {
        *self.port.lock().await
    }

    /// 获取当前模型路径
    pub async fn get_model_path(&self) -> Option<PathBuf> {
        let path_guard = self.model_path.lock().await;
        path_guard.clone()
    }

    /// 检查服务器健康状态（通过 HTTP 请求）
    pub async fn check_health(&self, port: u16) -> bool {
        let client = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{}/health", port);
        client
            .get(&url)
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }
}

impl Default for SidecarManager {
    fn default() -> Self {
        Self::new()
    }
}
