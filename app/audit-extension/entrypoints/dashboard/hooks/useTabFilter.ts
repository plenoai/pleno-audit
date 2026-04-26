import { useState, useCallback, useEffect } from "preact/hooks";

/**
 * Per-tab filter state management hook.
 * searchQuery はグローバル管理 (Header 検索) のため外部から受け取り、
 * tab 固有の typed filters のみ内部状態として保持する。
 */
export function useTabFilter<F extends Record<string, unknown> = Record<string, never>>(opts: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  initialFilters?: F;
}) {
  const { searchQuery, setSearchQuery, initialFilters } = opts;
  const [filters, setFilters] = useState<F>((initialFilters ?? {}) as F);

  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetAll = useCallback(() => {
    setSearchQuery("");
    setFilters((initialFilters ?? {}) as F);
  }, [initialFilters, setSearchQuery]);

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
