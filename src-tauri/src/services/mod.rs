//! 应用服务层
//! 封装业务逻辑，协调多个数据访问操作

use crate::database::{
    BookmarkRepository, CardRepository, ConfigRepository, HighlightRepository, SourceRepository,
    WebSnapshotRepository,
};
use crate::db::Database;
use std::sync::Arc;

pub mod source_service;
pub mod highlight_service;
pub mod bookmark_service;
pub mod card_service;
pub mod book_service;
pub mod web_reader_service;

pub use source_service::SourceService;
pub use highlight_service::HighlightService;
pub use bookmark_service::BookmarkService;
pub use card_service::CardService;
pub use book_service::BookService;
pub use web_reader_service::WebReaderService;

/// 服务层容器
/// 持有所有服务的引用
pub struct Services {
    pub source: SourceService,
    pub highlight: HighlightService,
    pub bookmark: BookmarkService,
    pub card: CardService,
    pub book: BookService,
    pub web_reader: WebReaderService,
}

impl Services {
    /// 创建所有服务实例
    pub fn new(db: Arc<Database>, vault_path: Option<std::path::PathBuf>) -> Self {
        let source_repo = Arc::new(SourceRepository::new(db.clone()));
        let highlight_repo = Arc::new(HighlightRepository::new(db.clone()));
        let bookmark_repo = Arc::new(BookmarkRepository::new(db.clone()));
        let web_snapshot_repo = Arc::new(WebSnapshotRepository::new(db.clone(), vault_path.clone()));
        let card_repo = Arc::new(CardRepository::new(db.clone()));
        let _config_repo = Arc::new(ConfigRepository::new(db.clone()));

        Self {
            source: SourceService::new(source_repo.clone()),
            highlight: HighlightService::new(highlight_repo.clone()),
            bookmark: BookmarkService::new(bookmark_repo.clone()),
            card: CardService::new(card_repo.clone(), source_repo.clone()),
            book: BookService::new(db.clone()),
            web_reader: WebReaderService::new(web_snapshot_repo.clone()),
        }
    }
}

