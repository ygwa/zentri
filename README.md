# Zentri

<p align="center">
  <strong>🧠 A local-first knowledge management app for researchers and lifelong learners</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri" alt="Tauri 2.0">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Rust-orange?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📝 **Zettelkasten Cards** | Atomic notes with fleeting, literature, permanent, and project types |
| 📚 **Digital Library** | Manage PDFs, EPUBs, articles, webpages, videos with highlight annotations |
| 🔗 **WikiLinks** | Bidirectional linking with `[[Title]]` syntax |
| 🕸️ **Knowledge Graph** | Visualize connections with PageRank-based importance ranking |
| 🎨 **Canvas Mode** | Spatial organization of ideas on infinite canvas |
| 🔍 **Full-Text Search** | Lightning-fast search with Chinese tokenization (Jieba) |
| 📅 **Daily Notes** | Quick capture with automatic date-based organization |
| 🏠 **Local-First** | Your data stays on your machine in plain JSON files |

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (recommended) or npm
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri backend)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/zentri.git
cd zentri

# Install dependencies
pnpm install

# Run in development mode (frontend + backend)
pnpm tauri dev

# Or run frontend only (with mock data)
pnpm dev
```

### Build for Production

```bash
pnpm tauri build
```

The built app will be in `src-tauri/target/release/bundle/`.

## 🏗️ Architecture

```
zentri/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── editor/         # TipTap rich text editor
│   │   ├── reader/         # PDF/EPUB reader
│   │   ├── canvas/         # Canvas whiteboard
│   │   └── views/          # Page views
│   ├── store/              # Zustand state management
│   ├── services/api/       # Backend API layer
│   └── pages/              # Route pages
│
├── src-tauri/              # Rust backend
│   └── src/
│       ├── commands/       # Tauri IPC commands
│       ├── models/         # Data structures
│       ├── storage.rs      # JSON file storage
│       ├── search.rs       # Tantivy full-text search
│       ├── graph.rs        # Knowledge graph (Petgraph)
│       └── db.rs           # SQLite metadata
│
└── docs/                   # Documentation
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Tauri 2.0](https://tauri.app/) |
| **Frontend** | React 19, TypeScript, TailwindCSS 4 |
| **Editor** | TipTap / ProseMirror |
| **State** | Zustand |
| **Backend** | Rust |
| **Database** | SQLite (rusqlite) + JSON files |
| **Search** | Tantivy + Jieba (Chinese) |
| **Graph** | Petgraph with PageRank |
| **Reader** | pdf.js, epub.js |

## 📖 Usage

### Vault Setup

On first launch, select a folder as your **Vault** — this is where all your notes and data will be stored.

### Card Types

- **Fleeting** (💡): Quick thoughts, ideas to process later
- **Literature** (📖): Notes from books/articles, linked to sources
- **Permanent** (🧠): Refined, interconnected knowledge atoms
- **Project** (📋): Long-form documents and project notes

### WikiLinks

Link notes using `[[Note Title]]` syntax. The graph view shows all connections.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Command palette |
| `Cmd/Ctrl + N` | New fleeting note |
| `Cmd/Ctrl + O` | Quick switcher |
| `Cmd/Ctrl + F` | Search |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ using Tauri, React, and Rust
</p>
