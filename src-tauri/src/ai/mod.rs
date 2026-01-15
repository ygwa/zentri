//! AI 模块
//! 负责管理本地 AI 引擎（llama-server sidecar）、模型管理、向量化和 RAG 功能

pub mod sidecar;
pub mod models;
pub mod embeddings;
pub mod rag;
pub mod manager;

pub use manager::AIManager;
pub use sidecar::SidecarManager;
pub use models::{ModelManager, ModelInfo, get_available_models};
pub use rag::RAGService;

