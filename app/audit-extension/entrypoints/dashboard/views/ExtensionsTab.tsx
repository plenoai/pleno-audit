import { useState, useEffect, useMemo } from "preact/hooks";
import { Badge, SearchInput, LoadingState, getTableCellStyles } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { useTheme, spacing, fontSize } from "../../../lib/theme";
import { truncate } from "../utils";
import { createLogger } from "libztbs/extension-runtime";
import { getPermissionRiskLevel, DANGEROUS_PERMISSIONS, type PermissionRiskLevel } from "libztbs/extension-analyzers";

const logger = createLogger("extensions-tab");

interface ExtensionInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  permissions: string[];
  hostPermissions: string[];
  installType: string;
  type: string;
  mayDisable: boolean;
  homepageUrl?: string;
  updateUrl?: string;
  icons?: { size: number; url: string }[];
}

type TagVariant = "danger" | "warning" | "info" | "success";

interface ExtTag {
  label: string;
  variant: TagVariant;
}

const RISK_LEVEL_ORDER: Record<PermissionRiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function getRiskLabel(level: PermissionRiskLevel): { text: string; variant: "danger" | "warning" | "info" | "default" } {
  switch (level) {
    case "critical": return { text: "High", variant: "danger" };
    case "high": return { text: "Medium", variant: "warning" };
    case "medium":
    case "low": return { text: "Low", variant: "info" };
  }
}

function getExtensionTags(ext: ExtensionInfo): ExtTag[] {
  const tags: ExtTag[] = [];
  const allPerms = [...ext.permissions, ...ext.hostPermissions];
  for (const p of allPerms) {
    const risk = DANGEROUS_PERMISSIONS.find((d) => d.permission === p);
    if (risk?.severity === "critical") tags.push({ label: p, variant: "danger" });
  }
  const hasAllUrls = ext.hostPermissions.some(
    (p) => p === "<all_urls>" || p === "*://*/*" || p === "http://*/*" || p === "https://*/*",
  );
  if (hasAllUrls) tags.push({ label: "<all_urls>", variant: "danger" });
  if (ext.updateUrl && !ext.updateUrl.includes("google.com")) {
    tags.push({ label: "外部更新", variant: "danger" });
  }
  if (!ext.mayDisable) tags.push({ label: "削除不可", variant: "warning" });
  if (!ext.enabled) tags.push({ label: "無効", variant: "info" });
  if (ext.installType === "admin") tags.push({ label: "管理者", variant: "warning" });
  return tags;
}

export function ExtensionsTab() {
  const { colors } = useTheme();
  const cellStyles = getTableCellStyles(colors);
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set());
  const { searchQuery, setSearchQuery } = useTabFilter({});

  useEffect(() => {
    (async () => {
      try {
        const allExtensions = await chrome.management.getAll();
        setExtensions(
          allExtensions
            .filter((ext) => ext.id !== chrome.runtime.id)
            .map((ext) => ({
              id: ext.id,
              name: ext.name,
              description: ext.description,
              version: ext.version,
              enabled: ext.enabled,
              permissions: ext.permissions || [],
              hostPermissions: ext.hostPermissions || [],
              installType: ext.installType,
              type: ext.type,
              mayDisable: ext.mayDisable,
              homepageUrl: ext.homepageUrl,
              updateUrl: ext.updateUrl,
              icons: ext.icons,
            })),
        );
      } catch (error) {
        logger.error("Failed to load extensions", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tagSummary = useMemo(() => {
    const map = new Map<string, { variant: TagVariant; count: number }>();
    for (const ext of extensions) {
      for (const tag of getExtensionTags(ext)) {
        const existing = map.get(tag.label);
        if (existing) {
          existing.count++;
        } else {
          map.set(tag.label, { variant: tag.variant, count: 1 });
        }
      }
    }
    return [...map.entries()]
      .map(([label, { variant, count }]) => ({ label, variant, count }))
      .sort((a, b) => b.count - a.count);
  }, [extensions]);

  const toggleTagFilter = (label: string) => {
    setActiveTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = extensions;
    if (activeTagFilters.size > 0) {
      result = result.filter((ext) => {
        const tags = getExtensionTags(ext);
        return tags.some((t) => activeTagFilters.has(t.label));
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ext) =>
          ext.name.toLowerCase().includes(q) ||
          ext.description.toLowerCase().includes(q) ||
          ext.permissions.some((p) => p.toLowerCase().includes(q)) ||
          ext.hostPermissions.some((p) => p.toLowerCase().includes(q)),
      );
    }
    // Sort by risk level descending
    result = [...result].sort((a, b) => {
      const levelA = RISK_LEVEL_ORDER[getPermissionRiskLevel(a.permissions, a.hostPermissions)];
      const levelB = RISK_LEVEL_ORDER[getPermissionRiskLevel(b.permissions, b.hostPermissions)];
      return levelA - levelB;
    });
    return result;
  }, [extensions, searchQuery, activeTagFilters]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <FilteredTab
      data={filtered}
      rowKey={(ext) => ext.id}
      rowHighlight={() => false}
      onRowClick={(ext) => toggleExpand(ext.id)}
      expandRow={(ext) => {
        if (!expandedIds.has(ext.id)) return null;
        const allPerms = [...ext.permissions, ...ext.hostPermissions];
        const hasPerms = allPerms.length > 0;
        const hasHomepage = !!ext.homepageUrl;

        if (!hasPerms && !hasHomepage) return null;

        const shown = allPerms.slice(0, 10);
        const remaining = allPerms.length - shown.length;

        return (
          <div style={cellStyles.expandContainer}>
            {/* Homepage link */}
            {hasHomepage && (
              <div
                style={{
                  ...cellStyles.expandRow,
                  display: "flex",
                  gap: spacing.sm,
                  fontSize: fontSize.sm,
                }}
              >
                <span style={{ color: colors.textMuted }}>HP:</span>
                <a
                  href={ext.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={cellStyles.link}
                  onClick={(e) => e.stopPropagation()}
                >
                  {truncate(ext.homepageUrl!, 60)}
                </a>
              </div>
            )}
            {/* Permissions */}
            {shown.map((perm) => {
              const isAllUrls = perm === "<all_urls>" || perm === "*://*/*";
              const isDangerous = DANGEROUS_PERMISSIONS.some((d) => d.permission === perm && d.severity === "critical");
              return (
                <div
                  key={perm}
                  style={{
                    ...cellStyles.expandRow,
                    display: "flex",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <code
                    style={{
                      ...cellStyles.mono,
                      color: isAllUrls || isDangerous ? colors.status.danger.text : colors.textSecondary,
                    }}
                  >
                    └ {perm}
                  </code>
                </div>
              );
            })}
            {remaining > 0 && (
              <div style={cellStyles.expandRemaining}>
                他 {remaining} 件
              </div>
            )}
          </div>
        );
      }}
      emptyMessage="拡張機能が見つかりません"
      filterBar={
        <>
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="拡張機能名、権限で検索..." />
          {tagSummary.map((tag) => (
            <Badge
              key={tag.label}
              variant={tag.variant}
              active={activeTagFilters.has(tag.label)}
              onClick={() => toggleTagFilter(tag.label)}
            >
              {tag.label} ({tag.count})
            </Badge>
          ))}
        </>
      }
      columns={[
        {
          key: "risk",
          header: "リスク",
          width: "70px",
          render: (ext) => {
            const level = getPermissionRiskLevel(ext.permissions, ext.hostPermissions);
            const risk = getRiskLabel(level);
            return <Badge variant={risk.variant} size="sm">{risk.text}</Badge>;
          },
        },
        {
          key: "name",
          header: "拡張機能名",
          render: (ext) => {
            const allPerms = [...ext.permissions, ...ext.hostPermissions];
            const isExpanded = expandedIds.has(ext.id);
            return (
              <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                <span
                  style={{
                    ...cellStyles.expandArrowBase,
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                >
                  ▶
                </span>
                {ext.icons?.[0]?.url && (
                  <img src={ext.icons[0].url} alt="" style={{ width: "16px", height: "16px" }} />
                )}
                <span>{ext.name}</span>
                {allPerms.length > 0 && (
                  <Badge variant={allPerms.length > 10 ? "warning" : "info"} size="sm">{allPerms.length}</Badge>
                )}
              </div>
            );
          },
        },
        {
          key: "tags",
          header: "タグ",
          width: "220px",
          render: (ext) => {
            const tags = getExtensionTags(ext);
            if (tags.length === 0) return <span style={cellStyles.muted}>-</span>;
            return (
              <div style={cellStyles.tags}>
                {tags.map((tag) => (
                  <Badge key={tag.label} variant={tag.variant} size="sm">{tag.label}</Badge>
                ))}
              </div>
            );
          },
        },
        {
          key: "version",
          header: "バージョン",
          width: "100px",
          render: (ext) => <code style={{ fontSize: fontSize.sm }}>{ext.version}</code>,
        },
      ]}
    />
  );
}
