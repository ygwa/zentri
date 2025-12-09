import { useEffect, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CardList } from "@/components/card-list";
import { EditorPanel } from "@/components/editor-panel";
import { SearchDialog } from "@/components/search-dialog";
import { CreateCardDialog } from "@/components/create-card-dialog";

import "./App.css";

function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // 全局快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K - 搜索
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      // ⌘N - 新建
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setCreateOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar
        onSearch={() => setSearchOpen(true)}
        onCreateCard={() => setCreateOpen(true)}
      />
      <SidebarInset>
        <div className="flex h-screen">
          <CardList />
          <EditorPanel />
        </div>
      </SidebarInset>

      {/* 对话框 */}
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <CreateCardDialog open={createOpen} onOpenChange={setCreateOpen} />
    </SidebarProvider>
  );
}

export default App;
