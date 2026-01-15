import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAppStore } from "@/store";
import { CanvasEditorView } from "@/components/views/canvas-editor-view";
import { Button } from "@/components/ui/button";
import { LEGACY_ROUTES } from "@/router/constants";

export function CanvasDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { canvases, loadCanvases, loadCanvas } = useAppStore();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            if (canvases.length === 0) {
                await loadCanvases();
            }
            if (id) {
                await loadCanvas(id);
            }
            setIsLoading(false);
        };
        loadData();
    }, [id, canvases.length, loadCanvases, loadCanvas]);

    const canvas = canvases.find(c => c.id === id);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-zinc-50">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
            </div>
        );
    }

    if (!canvas || !id) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-zinc-50">
                <div className="text-zinc-400 text-sm">Canvas not found</div>
                <Button variant="outline" size="sm" onClick={() => navigate(LEGACY_ROUTES.BOARDS)}>
                    <ArrowLeft size={14} className="mr-2" />
                    Back to Boards
                </Button>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full h-full relative overflow-hidden bg-zinc-50">
            <CanvasEditorView
                canvasId={id}
                onClose={() => navigate(LEGACY_ROUTES.BOARDS)}
            />
        </div>
    );
}
