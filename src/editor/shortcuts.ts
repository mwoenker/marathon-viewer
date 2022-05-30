import { useEffect } from "preact/hooks";
import { UpdateState } from "./state";

export function useKeyboardShortcuts(updateState: UpdateState): void {
    useEffect(() => {
        function keyListener(e: KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    updateState({ type: 'redo' });
                } else {
                    updateState({ type: 'undo' });
                }
            }
        }

        window.addEventListener('keydown', keyListener);

        return () => {
            window.removeEventListener('keydown', keyListener);
        };
    }, [updateState]);
}
