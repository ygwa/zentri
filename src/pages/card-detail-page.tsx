import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/store";
import { NoteEditorView } from "@/components/views/note-editor-view";
import { Button } from "@/components/ui/button";
import { getCardRoute } from "@/lib/card-routes";
import { LEGACY_ROUTES } from "@/router/constants";

/**
 * 通用卡片详情页面 - 根据卡片类型重定向到对应的专用页面
 * 主要用于临时笔记 (fleeting) 和文献笔记 (literature)
 */
export function CardDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { cards } = useAppStore();
    // 内容已经在 store 中加载完成，无需再次加载
    const card = cards.find(c => c.id === id);

    useEffect(() => {
        // 根据卡片类型重定向到对应的路由
        if (card) {
            if (card.type === 'permanent' || card.type === 'project') {
                if (id) {
                    navigate(getCardRoute(card.type, id), { replace: true });
                }
            }
            // fleeting 和 literature 类型继续使用当前页面
        }
    }, [card, id, navigate]);

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

    // 只处理 fleeting 和 literature 类型的卡片
    if (card.type !== 'fleeting' && card.type !== 'literature') {
        return null; // 等待重定向
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
