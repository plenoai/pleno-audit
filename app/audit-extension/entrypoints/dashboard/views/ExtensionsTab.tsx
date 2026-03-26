import { useState, useEffect, useMemo } from "preact/hooks";
import { Badge, SearchInput, getTableCellStyles, expandArrowStyle } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { useTheme } from "../../../lib/theme";
import { truncate } from "../utils";
import { createLogger } from "@libztbs/extension-runtime";
import { getPermissionRiskLevel, DANGEROUS_PERMISSIONS } from "@libztbs/extension-analyzers";

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

  /** 全拡張機能のタグを集計 → {label, variant, count} */
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
    return <div style={{ color: colors.textSecondary, textAlign: "center", padding: "24px" }}>読み込み中...</div>;
  }

  return (
    <FilteredTab
      data={filtered}
      rowKey={(ext) => ext.id}
      rowHighlight={(ext) => getPermissionRiskLevel(ext.permissions, ext.hostPermissions) === "critical"}
      onRowClick={(ext) => {
        const allPerms = [...ext.permissions, ...ext.hostPermissions];
        if (allPerms.length > 0) toggleExpand(ext.id);
      }}
      expandRow={(ext) => {
        if (!expandedIds.has(ext.id)) return null;
        const allPerms = [...ext.permissions, ...ext.hostPermissions];
        if (allPerms.length === 0) return null;
        const shown = allPerms.slice(0, 10);
        const remaining = allPerms.length - shown.length;
        return (
          <div style={cellStyles.expandContainer}>
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
                    gap: "8px",
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
          key: "name",
          header: "拡張機能名",
          render: (ext) => {
            const allPerms = [...ext.permissions, ...ext.hostPermissions];
            const hasPerms = allPerms.length > 0;
            const isExpanded = expandedIds.has(ext.id);
            return (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={expandArrowStyle(cellStyles.expandArrowBase, isExpanded, hasPerms)}>
                  ▶
                </span>
                {ext.icons?.[0]?.url && (
                  <img src={ext.icons[0].url} alt="" style={{ width: "16px", height: "16px" }} />
                )}
                <span>{ext.name}</span>
                {hasPerms && (
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
          key: "homepage",
          header: "ホームページ",
          width: "160px",
          render: (ext) =>
            ext.homepageUrl ? (
              <a
                href={ext.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={cellStyles.link}
              >
                {truncate(ext.homepageUrl, 25)}
              </a>
            ) : (
              <span style={cellStyles.muted}>-</span>
            ),
        },
        {
          key: "version",
          header: "バージョン",
          width: "100px",
          render: (ext) => <code style={{ fontSize: "11px" }}>{ext.version}</code>,
        },
      ]}
    />
  );
}
