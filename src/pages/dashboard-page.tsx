import { useNavigate } from "react-router-dom";
import { DashboardView } from "@/components/views/dashboard-view";
import { useAppStore } from "@/store";
import { getCardRoute } from "@/lib/card-routes";
import { LEGACY_ROUTES } from "@/router/constants";

export function DashboardPage() {
    const navigate = useNavigate();
    const { getCardById } = useAppStore();

    const handleOpenCard = (id: string) => {
        const card = getCardById(id);
        if (!card) {
            // 如果卡片不存在，使用默认路由
            navigate(LEGACY_ROUTES.CARD(id));
            return;
        }

        // 根据卡片类型导航到对应的路由
        navigate(getCardRoute(card.type, id));
    };

    const handleOpenProject = (id: string) => {
        navigate(LEGACY_ROUTES.PROJECT(id));
    };

    return (
        <DashboardView
            onOpenCard={handleOpenCard}
            onOpenProject={handleOpenProject}
        />
    );
}
