//! 数据库访问层
//! 提供细粒度的数据访问接口，按实体组织

use crate::db::Database;
use std::sync::Arc;

pub mod source;
pub mod highlight;
pub mod bookmark;
pub mod web_snapshot;
pub mod config;
pub mod card;

pub use source::SourceRepository;
pub use highlight::HighlightRepository;
pub use bookmark::BookmarkRepository;
pub use web_snapshot::WebSnapshotRepository;
pub use config::ConfigRepository;
pub use card::CardRepository;

/// 数据库访问层 trait
/// 所有 repository 都应该实现这个 trait
pub trait Repository {
    fn db(&self) -> &Arc<Database>;
}

