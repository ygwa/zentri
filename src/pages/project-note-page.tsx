import { useParams, useNavigate } from "react-router-dom";

import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/store";
import { ProjectEditorView } from "@/components/views/project-editor-view";
import { Button } from "@/components/ui/button";
import { getCardRoute } from "@/lib/card-routes";
import { LEGACY_ROUTES } from "@/router/constants";

export function ProjectNotePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { cards } = useAppStore();
    // 内容已经在 store 中加载完成，无需再次加载
    const card = cards.find(c => c.id === id);

    if (!card || !id) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="text-zinc-400 text-sm">Card not found</div>
                <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                    <ArrowLeft size={14} className="mr-2" />
                    Go Back
                </Button>
            </div>
        );
    }

    // 如果不是项目笔记，重定向到正确的路由
    if (card.type !== 'project') {
        navigate(getCardRoute(card.type, id), { replace: true });
        return null;
    }

    return (
        <div className="flex-1 flex flex-col h-full relative">
            <ProjectEditorView
                projectId={id}
                onClose={() => navigate(LEGACY_ROUTES.DASHBOARD)}
            />
        </div>
    );
}

