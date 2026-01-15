import { useAppStore } from "@/store";
import { ReaderView } from "@/components/views/reader-view";
import { CommandPalette } from "@/components/command-palette";

/**
 * Reader Overlay 组件
 */
export function ReaderOverlay({ sourceId, onClose }: { sourceId: string | null; onClose: () => void }): React.ReactNode | null {
    const { getSourceById } = useAppStore();
    
    if (!sourceId) return null;
    
    const source = getSourceById(sourceId);
    if (!source) return null;

    return (
        <ReaderView
            source={source}
            onClose={onClose}
        />
    );
}

/**
 * Global Command Palette Overlay 组件
 */
export function GlobalCommandPalette({
    isOpen,
    onClose,
    onViewChange,
    onOpenCard,
}: {
    isOpen: boolean;
    onClose: () => void;
    onViewChange: (view: string) => void;
    onOpenCard: (id: string) => void;
}): React.ReactNode {
    return (
        <CommandPalette
            isOpen={isOpen}
            onClose={onClose}
            onViewChange={onViewChange}
            onOpenCard={onOpenCard}
        />
    );
}



