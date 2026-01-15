import { useNavigate } from "react-router-dom";
import { LibraryView } from "@/components/views/library-view";
import type { Source } from "@/types";
import { LEGACY_ROUTES } from "@/router/constants";

export function LibraryPage() {
    const navigate = useNavigate();

    const handleRead = (source: Source) => {
        navigate(LEGACY_ROUTES.SOURCE(source.id));
    };

    return <LibraryView onRead={handleRead} />;
}
