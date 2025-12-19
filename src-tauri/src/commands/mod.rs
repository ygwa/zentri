//! Tauri Commands 模块
//! 按功能组织所有 Tauri 命令

pub mod canvas;
pub mod cards;
pub mod crdt;
pub mod daily;
pub mod graph;
pub mod highlights;
pub mod search;
pub mod sources;
pub mod vault;
pub mod watcher;
pub mod web_reader;

// 重新导出所有命令
pub use canvas::*;
pub use cards::*;
pub use crdt::*;
pub use daily::*;
pub use graph::*;
pub use highlights::*;
pub use search::*;
pub use sources::*;
pub use vault::*;
pub use watcher::*;
pub use web_reader::*;
