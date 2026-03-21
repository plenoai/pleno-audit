import { useState, useCallback, useEffect } from "preact/hooks";

/**
 * Per-tab filter state management hook.
 * Each tab owns its own searchQuery and additional typed filters,
 * eliminating cross-tab state pollution.
 */
export function useTabFilter<F extends Record<string, unknown> = Record<string, never>>(
  initialFilters?: F
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<F>((initialFilters ?? {}) as F);

  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetAll = useCallback(() => {
    setSearchQuery("");
    setFilters((initialFilters ?? {}) as F);
  }, [initialFilters]);

  // Escape key resets filters for the active tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        resetAll();
      }
      if (e.key === "/" && !isEditable(e.target as HTMLElement | null)) {
        e.preventDefault();
        (document.querySelector("[data-dashboard-search]") as HTMLInputElement | null)?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetAll]);

  return { searchQuery, setSearchQuery, filters, setFilter, resetAll };
}

function isEditable(target: HTMLElement | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    !!target?.isContentEditable
  );
}
