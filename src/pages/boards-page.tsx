import { useNavigate } from "react-router-dom";
import { CanvasGridView } from "@/components/views/canvas-grid-view";
import { LEGACY_ROUTES } from "@/router/constants";

export function BoardsPage() {
    const navigate = useNavigate();

    return (
        <CanvasGridView
            onOpenCanvas={(id) => navigate(LEGACY_ROUTES.CANVAS(id))}
        />
    );
}
