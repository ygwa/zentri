import { useParams, useNavigate } from "react-router-dom";

import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/store";
import { NoteEditorView } from "@/components/views/note-editor-view";
import { Button } from "@/components/ui/button";
import { getCardRoute } from "@/lib/card-routes";
import { LEGACY_ROUTES } from "@/router/constants";

export function PermanentNotePage() {
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

    // 如果不是永久笔记，重定向到正确的路由
    if (card.type !== 'permanent') {
        navigate(getCardRoute(card.type, id), { replace: true });
        return null;
    }

    return (
        <div className="flex-1 flex flex-col h-full relative">
            <NoteEditorView
                cardId={id}
                onClose={() => navigate(LEGACY_ROUTES.DASHBOARD)}
                onNavigate={(targetId) => {
                    const targetCard = cards.find(c => c.id === targetId);
                    if (targetCard) {
                        navigate(getCardRoute(targetCard.type, targetId));
                    } else {
                        navigate(LEGACY_ROUTES.CARD(targetId));
                    }
                }}
            />
        </div>
    );
}

