import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  FolderOpen,
  Sparkles,
  BookOpen,
  StickyNote,
  FolderKanban,
  ArrowRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isTauriEnv } from "@/lib/api";

interface VaultSelectorProps {
  onSelect: (path: string) => void;
  isLoading?: boolean;
}

export function VaultSelector({ onSelect, isLoading }: VaultSelectorProps) {
  const [path, setPath] = useState("");
  const [step, setStep] = useState<"welcome" | "select">("welcome");

  const handleSubmit = () => {
    if (path.trim()) {
      onSelect(path.trim());
    }
  };

  // 欢迎页面
  if (step === "welcome") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="max-w-2xl w-full mx-4">
          {/* Logo 和标题 */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-orange-500/25 mb-6">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-10 h-10 text-white"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-3">
              欢迎使用 <span className="text-orange-600">Zentri</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              理清思维的脉络，让知识成为体系
            </p>
          </div>

          {/* 特性介绍 */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            <FeatureCard
              icon={Sparkles}
              iconColor="text-amber-600"
              iconBg="bg-amber-50"
              title="闪念捕捉"
              description="快速记录灵感，不打断思维流"
            />
            <FeatureCard
              icon={BookOpen}
              iconColor="text-sky-600"
              iconBg="bg-sky-50"
              title="深度阅读"
              description="内置阅读器，边读边记笔记"
            />
            <FeatureCard
              icon={StickyNote}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
              title="知识沉淀"
              description="卢曼卡片盒方法，建立知识网络"
            />
            <FeatureCard
              icon={FolderKanban}
              iconColor="text-violet-600"
              iconBg="bg-violet-50"
              title="项目管理"
              description="从笔记到产出，一站式工作流"
            />
          </div>

          {/* 开始按钮 */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={() => setStep("select")}
              className="h-12 px-8 text-base gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25"
            >
              开始使用
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 选择 Vault 路径
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Card className="max-w-lg w-full mx-4 shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-orange-500/20 mx-auto mb-4">
            <FolderOpen className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold">选择笔记库位置</h2>
          <p className="text-muted-foreground">
            所有笔记将以 Markdown 文件形式存储在这个文件夹
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 路径输入 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">笔记库路径</label>
            <div className="flex gap-2">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="例如: ~/Documents/Zentri"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <Button
                variant="outline"
                onClick={async () => {
                  if (isTauriEnv()) {
                    try {
                      // 动态导入 Tauri dialog
                      const { open } = await import("@tauri-apps/plugin-dialog");
                      const selected = await open({
                        directory: true,
                        multiple: false,
                        title: "选择笔记库文件夹",
                      });
                      if (selected && typeof selected === "string") {
                        setPath(selected);
                      }
                    } catch (err) {
                      console.error("Failed to open folder dialog:", err);
                    }
                  } else {
                    // 非 Tauri 环境使用默认路径
                    setPath("~/Documents/Zentri");
                  }
                }}
              >
                浏览...
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              如果文件夹不存在，将自动创建
            </p>
          </div>

          {/* 文件夹结构预览 */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium mb-3">将创建以下结构：</p>
            <div className="space-y-1 text-sm font-mono text-muted-foreground">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-amber-500" />
                <span>00_Inbox/</span>
                <span className="text-xs opacity-60">— 闪念笔记</span>
              </div>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-sky-500" />
                <span>10_References/</span>
                <span className="text-xs opacity-60">— 文献素材</span>
              </div>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-emerald-500" />
                <span>20_Slipbox/</span>
                <span className="text-xs opacity-60">— 永久卡片</span>
              </div>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-violet-500" />
                <span>30_Projects/</span>
                <span className="text-xs opacity-60">— 项目产出</span>
              </div>
            </div>
          </div>

          {/* 确认按钮 */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep("welcome")}
              className="flex-1"
            >
              返回
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!path.trim() || isLoading}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  创建中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  确认创建
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 特性卡片组件
function FeatureCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-white border shadow-sm">
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
          iconBg
        )}
      >
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
      <div>
        <h3 className="font-semibold mb-0.5">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

