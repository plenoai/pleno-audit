import { useMemo, useState } from "preact/hooks";

type TagVariant = "danger" | "warning" | "info" | "success";

export interface TagSummaryItem {
  label: string;
  variant: TagVariant;
  count: number;
}

/**
 * Compute tag summary from items + extract tags, and manage active tag filter state.
 * Shared between Extensions and Services tabs.
 */
export function useTagFilter<T>(
  items: T[],
  getItemTags: (item: T) => { label: string; variant: TagVariant }[],
) {
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set());

  const tagSummary = useMemo(() => {
    const map = new Map<string, { variant: TagVariant; count: number }>();
    for (const item of items) {
      for (const tag of getItemTags(item)) {
        const existing = map.get(tag.label);
        if (existing) existing.count++;
        else map.set(tag.label, { variant: tag.variant, count: 1 });
      }
    }
    return [...map.entries()]
      .map(([label, { variant, count }]) => ({ label, variant, count }))
      .sort((a, b) => b.count - a.count);
  }, [items, getItemTags]);

  const toggleTagFilter = (label: string) => {
    setActiveTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const filterByTags = useMemo(() => {
    if (activeTagFilters.size === 0) return items;
    return items.filter((item) => {
      const tags = getItemTags(item);
      return tags.some((t) => activeTagFilters.has(t.label));
    });
  }, [items, activeTagFilters, getItemTags]);

  const resetTagFilters = () => setActiveTagFilters(new Set());

  return { tagSummary, activeTagFilters, toggleTagFilter, resetTagFilters, filterByTags };
}
