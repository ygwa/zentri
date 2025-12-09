import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  BookOpen,
  StickyNote,
  FolderKanban,
  LayoutGrid,
  Search,
  Plus,
  Settings,
} from "lucide-react";
import { useAppStore } from "@/store";
import type { ViewType } from "@/types";

const navItems: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "全部", icon: LayoutGrid },
  { id: "fleeting", label: "闪念", icon: Sparkles },
  { id: "literature", label: "文献", icon: BookOpen },
  { id: "permanent", label: "永久", icon: StickyNote },
  { id: "project", label: "项目", icon: FolderKanban },
];

interface AppSidebarProps {
  onSearch: () => void;
  onCreateCard: () => void;
}

export function AppSidebar({ onSearch, onCreateCard }: AppSidebarProps) {
  const { currentView, setCurrentView, cards } = useAppStore();

  // 计算每个分类的数量
  const getCounts = (type: ViewType) => {
    if (type === "all") return cards.length;
    return cards.filter((c) => c.type === type).length;
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
            Z
          </div>
          <span className="font-semibold">Zentri</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* 快捷操作 */}
        <SidebarGroup>
          <SidebarGroupContent className="px-2 py-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-start gap-2"
                onClick={onSearch}
              >
                <Search className="h-4 w-4" />
                搜索
                <kbd className="ml-auto text-xs text-muted-foreground">⌘K</kbd>
              </Button>
              <Button size="sm" onClick={onCreateCard}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 导航 */}
        <SidebarGroup>
          <SidebarGroupLabel>卡片盒</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentView === item.id}
                    onClick={() => setCurrentView(item.id)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    <SidebarMenuBadge>{getCounts(item.id)}</SidebarMenuBadge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <Settings className="h-4 w-4" />
              <span>设置</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

