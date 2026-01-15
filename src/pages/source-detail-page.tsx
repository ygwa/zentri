import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/store";
import { ReaderView } from "@/components/views/reader-view";
import { Button } from "@/components/ui/button";
import type { Source } from "@/types";
import { LEGACY_ROUTES } from "@/router/constants";

export function SourceDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { sources, loadSources } = useAppStore();
    const [isLoading, setIsLoading] = useState(true);
    const [source, setSource] = useState<Source | null>(null);

    useEffect(() => {
        const loadSource = async () => {
            setIsLoading(true);
            // Ensure sources are loaded
            if (sources.length === 0) {
                await loadSources();
            }
            setIsLoading(false);
        };
        loadSource();
    }, [sources.length, loadSources]);

    useEffect(() => {
        if (id && sources.length > 0) {
            const found = sources.find(s => s.id === id);
            setSource(found || null);
        }
    }, [id, sources]);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-zinc-400 text-sm">Loading...</div>
            </div>
        );
    }

    if (!source) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="text-zinc-400 text-sm">Source not found</div>
                <Button variant="outline" size="sm" onClick={() => navigate(LEGACY_ROUTES.LIBRARY)}>
                    <ArrowLeft size={14} className="mr-2" />
                    Back to Library
                </Button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full">
            <ReaderView
                source={source}
                onClose={() => navigate(LEGACY_ROUTES.LIBRARY)}
            />
        </div>
    );
}
