import { useLocation } from "react-router-dom";
import { MainLayout } from "./main-layout";
import { FullscreenLayout } from "./fullscreen-layout";
import { FocusLayout } from "./focus-layout";
import { SettingsLayout } from "./settings-layout";
import { getLayoutFromPath } from "@/router/utils";

/**
 * 布局路由器
 * 根据路由元数据选择适当的布局
 */
export function LayoutRouter() {
    const location = useLocation();
    const layout = getLayoutFromPath(location.pathname);

    switch (layout) {
        case "fullscreen":
            return <FullscreenLayout />;
        case "focus":
            return <FocusLayout />;
        case "settings":
            return <SettingsLayout />;
        case "main":
        default:
            return <MainLayout />;
    }
}



