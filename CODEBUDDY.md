# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Development Commands

### Frontend Development
```bash
# Install dependencies
pnpm install

# Run frontend development server (browser mode - mock data)
pnpm dev

# Build frontend only
pnpm build

# Type check TypeScript code
tsc

# Preview production build
pnpm preview
```

### Full Application Development
```bash
# Run full Tauri application (frontend + backend)
pnpm tauri dev

# Build production application
pnpm tauri build

# Tauri CLI commands
pnpm tauri [command]    # Run any Tauri CLI command
```

### Backend Development
```bash
# From src-tauri directory
cd src-tauri

# Check Rust code for errors
cargo check

# Build Rust backend
cargo build

# Run Rust tests
cargo test

# Run with specific features
cargo run --features [feature-name]
```

## Architecture Overview

Zentri is a Tauri-based knowledge management application with a React frontend and Rust backend. The architecture separates concerns between UI (React) and business logic (Rust) while maintaining type safety across the boundary.

### Key Directories

**Frontend (`/src`)**
- `components/` - UI components organized by feature (25+ components)
- `hooks/` - Custom React hooks for state management
- `lib/` - Utility functions and configuration
- `services/` - API layer for frontend-backend communication
- `store/` - Zustand state management with domain-specific slices
- `types/` - TypeScript type definitions

**Backend (`/src-tauri/src`)**
- `commands/` - Tauri command handlers (45+ commands)
- `models/` - Data structures and database models
- `db.rs` - Database operations (SQLite)
- `storage.rs` - File-based JSON storage
- `search.rs` - Full-text search (Tantivy + Jieba)
- `graph.rs` - Knowledge graph (petgraph + PageRank)
- `crdt.rs` - Collaborative editing (Y.js/Yrs)
- `watcher.rs` - File system monitoring
- `web_reader.rs` - Web content extraction

### Data Flow

**Frontend Architecture**
```typescript
// Data flow: UI Components → Store → API → Backend Commands
App.tsx → useAppStore → services/api → Tauri commands
```

**Backend Architecture**
```
Application State → Command Handlers → Domain Services → Database/Storage
```

### Core Features

#### 1. Knowledge Management
- **Cards**: Core knowledge units with types (fleeting, literature, permanent, project)
- **Sources**: References/inputs (books, articles, webpages)
- **Highlights**: Extracted content from sources
- **Canvas**: Visual workspace for organizing ideas

#### 2. Content Processing
- **Rich Text Editor**: TipTap-based with custom extensions
- **PDF/EPUB Reader**: Built with pdfjs-dist and epubjs
- **Web Content**: Fetch and extract with readability algorithm
- **Markdown Support**: JSON storage with wiki-style links

#### 3. Search & Discovery
- **Full-text Search**: Tantivy with Chinese tokenization (Jieba)
- **Knowledge Graph**: Petgraph-based with PageRank algorithm
- **Backlinks**: Automatic relationship discovery
- **Tag-based Filtering**: Categorization and organization

### State Management

**Frontend (Zustand)**
- Single store with domain-specific actions
- Supports mock mode for browser development
- Async actions for all CRUD operations

**Backend (Tauri State)**
- Database connection management
- Search index for full-text search
- File watcher for real-time updates
- Vault path configuration

### Frontend-Backend Communication

**API Layer (`/src/services/api`)**
- Type-safe TypeScript definitions
- Mock support for non-Tauri environments
- Modular architecture per domain

**Tauri Commands (`/src-tauri/src/commands`)**
- 45+ commands covering all functionality
- Consistent error handling with `Result<T, String>`
- Shared application state through Tauri's `manage()`

### Configuration

**Key Files**
- `package.json` - Frontend dependencies and build scripts
- `Cargo.toml` - Rust dependencies and backend configuration
- `vite.config.ts` - Frontend build configuration
- `tauri.conf.json` - Tauri application configuration
- `tsconfig.json` - TypeScript configuration

**Environment Handling**
- **Tauri Mode**: Full functionality with file system access
- **Browser Mode**: Mock data for UI development without Rust backend
- Check environment with `api.isTauriEnv()` before backend calls

### Data Storage

**Dual System**
- **Content**: TipTap JSON documents in vault files
- **Metadata**: SQLite database for search and relations
- **Search Index**: Tantivy with file-based persistence

**File Organization**
- Vault-based structure with `.zentri` configuration directory
- Automatic indexing and graph building
- File watcher for real-time synchronization

### Development Patterns

#### Type Safety
- **Rust**: Snake case, Result types for errors, Chinese comments for domain concepts
- **TypeScript**: Camel case, async/await, types normalized in API layer
- **Shared Types**: Defined in `src/types/index.ts` with TipTap JSON schema

#### Error Handling
- Consistent error responses across all commands
- Frontend error boundaries and user feedback
- Logging through Tauri's plugin system

#### Testing Strategy
- Manual testing through development builds
- Focus on integration testing for command handlers
- File system operations tested with temporary directories

### Notable Dependencies

**Frontend**
- `@xyflow/react` - Visual canvases
- `@tiptap/react` - Rich text editor
- `@dnd-kit` - Drag & drop functionality
- `zustand` - State management

**Backend**
- `tantivy` - Full-text search engine
- `petgraph` - Graph data structures
- `yrs` - CRDT for collaborative editing
- `rusqlite`/`sqlx` - Database operations

## Development Tips

### Adding New Features
1. Define types in `src/types/`
2. Add API methods in `src/services/api/`
3. Implement Tauri commands in `src-tauri/src/commands/`
4. Create UI components in `src/components/`
5. Add state management in `src/store/`

### Debugging
- Use `console.log` in frontend (removed in production)
- Tauri logging: `tauri_plugin_log` for backend debugging
- File system operations: check vault path and permissions

### Performance Considerations
- Search indexing happens on file changes
- Graph rebuilding is incremental
- Large files are processed asynchronously
- Database operations use connection pooling