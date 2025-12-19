# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Install dependencies
pnpm install

# Run development server (frontend + backend)
pnpm tauri dev

# Run frontend only (for debugging without Rust backend)
pnpm dev

# Build production app
pnpm tauri build
```

### Backend Development
```bash
# In src-tauri directory
cargo check              # Check Rust code for errors
cargo build              # Build Rust backend
cargo test               # Run Rust tests

# Generate Tauri types for frontend
pnpm tauri android init  # Initialize mobile platform (if needed)
```

## Architecture Overview

Zentri is a Tauri-based knowledge management application with a React frontend and Rust backend. The architecture separates concerns between UI (React) and business logic (Rust) while maintaining type safety across the boundary.

### Key Architectural Patterns

1. **Frontend-Backend Communication**: Tauri commands via `invoke()` with type safety
   - Commands registered in `src-tauri/src/commands/mod.rs`
   - API layer in `src/services/api/` normalizes data between Rust/TypeScript
   - All commands return `Result<T, String>` for consistent error handling

2. **State Management**: Single Zustand store with domain-specific actions
   - Main store: `src/store/index.ts`
   - Supports mock mode for browser development
   - Async actions for all CRUD operations

3. **Content Storage**: Dual system - JSON files + SQLite metadata
   - Content stored as TipTap JSON documents in vault
   - Metadata indexed in SQLite for search and relations
   - Full-text search powered by Tantivy with Chinese tokenization (Jieba)

4. **Module Organization**:
   - **Frontend**: `src/components/` (views, editor, reader, canvas)
   - **Backend**: `src-tauri/src/` (commands, models, database, search, graph)
   - **Commands**: Feature-based modules (cards, sources, highlights, etc.)

### Core Components

- **TipTap Editor**: Rich text editor with custom extensions for references and wiki-links
- **Knowledge Graph**: Petgraph-based with PageRank algorithm for node importance
- **PDF/EPUB Reader**: Built with pdfjs-dist and epubjs, supports highlighting
- **CRDT Support**: Years/Yjs for collaborative editing capabilities
- **File Watcher**: Monitors vault for external changes (2s polling)

### Type Conventions

- **Rust**: Snake case, Result types for errors, Chinese comments for domain concepts
- **TypeScript**: Camel case, async/await, types normalized in API layer
- **Shared Types**: Defined in `src/types/index.ts` with TipTap JSON schema

### Environment Handling

The codebase supports running in two modes:
1. **Tauri Mode**: Full functionality with file system access
2. **Browser Mode**: Mock data for UI development without Rust backend

Check environment with `api.isTauriEnv()` before making backend calls.