import { useState, useEffect, useMemo } from "preact/hooks";
import { Badge, SearchInput } from "../../../components";
import { FilteredTab } from "../components/FilteredTab";
import { useTabFilter } from "../hooks/useTabFilter";
import { useTheme } from "../../../lib/theme";
import { truncate } from "../utils";
import { createLogger, getPermissionRiskLevel, DANGEROUS_PERMISSIONS } from "@libztbs/extension-runtime";

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


export function ExtensionsTab() {
  const { colors, isDark } = useTheme();
  const { searchQuery, setSearchQuery, filters, setFilter } = useTabFilter({
    external_update: false,
    not_removable: false,
    disabled: false,
    admin: false,
    all_urls: false,
  });
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
            }))
        );
      } catch (error) {
        logger.error("Failed to load extensions", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tagCounts = useMemo(() => {
    const counts = { external_update: 0, not_removable: 0, disabled: 0, admin: 0, all_urls: 0 };
    for (const ext of extensions) {
      if (ext.updateUrl && !ext.updateUrl.includes("google.com")) counts.external_update++;
      if (!ext.mayDisable) counts.not_removable++;
      if (!ext.enabled) counts.disabled++;
      if (ext.installType === "admin") counts.admin++;
      if (ext.hostPermissions.some((p) => p === "<all_urls>" || p === "*://*/*" || p === "http://*/*" || p === "https://*/*")) counts.all_urls++;
    }
    return counts;
  }, [extensions]);

  const filtered = useMemo(() => {
    let result = extensions;
    if (filters.external_update) result = result.filter((ext) => ext.updateUrl != null && !ext.updateUrl.includes("google.com"));
    if (filters.not_removable) result = result.filter((ext) => !ext.mayDisable);
    if (filters.disabled) result = result.filter((ext) => !ext.enabled);
    if (filters.admin) result = result.filter((ext) => ext.installType === "admin");
    if (filters.all_urls) result = result.filter((ext) => ext.hostPermissions.some((p) => p === "<all_urls>" || p === "*://*/*" || p === "http://*/*" || p === "https://*/*"));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ext) =>
          ext.name.toLowerCase().includes(q) ||
          ext.description.toLowerCase().includes(q) ||
          ext.permissions.some((p) => p.toLowerCase().includes(q)) ||
          ext.hostPermissions.some((p) => p.toLowerCase().includes(q))
      );
    }
    return result;
  }, [extensions, searchQuery, filters.external_update, filters.not_removable, filters.disabled, filters.admin, filters.all_urls]);

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
          <div style={{ background: colors.bgSecondary }}>
            {shown.map((perm) => {
              const isAllUrls = perm === "<all_urls>" || perm === "*://*/*";
              const isDangerous = DANGEROUS_PERMISSIONS.some((d) => d.permission === perm && d.severity === "critical");
              return (
                <div
                  key={perm}
                  style={{
                    padding: "4px 16px 4px 48px",
                    borderBottom: `1px solid ${colors.borderLight}`,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <code
                    style={{
                      fontSize: "11px",
                      fontFamily: "monospace",
                      color: isAllUrls || isDangerous ? colors.danger ?? "#ef4444" : colors.textSecondary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    └ {perm}
                  </code>
                </div>
              );
            })}
            {remaining > 0 && (
              <div
                style={{
                  padding: "4px 16px 4px 48px",
                  color: colors.textMuted,
                  fontStyle: "italic",
                  fontSize: "11px",
                }}
              >
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
          <Badge variant="danger" active={filters.external_update} onClick={() => setFilter("external_update", !filters.external_update)}>
            外部更新 ({tagCounts.external_update})
          </Badge>
          <Badge variant="warning" active={filters.not_removable} onClick={() => setFilter("not_removable", !filters.not_removable)}>
            削除不可 ({tagCounts.not_removable})
          </Badge>
          <Badge variant="info" active={filters.disabled} onClick={() => setFilter("disabled", !filters.disabled)}>
            無効 ({tagCounts.disabled})
          </Badge>
          <Badge variant="warning" active={filters.admin} onClick={() => setFilter("admin", !filters.admin)}>
            管理者 ({tagCounts.admin})
          </Badge>
          <Badge variant="danger" active={filters.all_urls} onClick={() => setFilter("all_urls", !filters.all_urls)}>
            &lt;all_urls&gt; ({tagCounts.all_urls})
          </Badge>
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
                <span
                  style={{
                    fontSize: "10px",
                    color: colors.textSecondary,
                    opacity: hasPerms ? 1 : 0.3,
                    transition: "transform 0.2s",
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    display: "inline-block",
                    width: "12px",
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
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
            const allPerms = [...ext.permissions, ...ext.hostPermissions];
            const tags: { label: string; variant: "danger" | "warning" | "info" | "success" }[] = [];
            for (const p of allPerms) {
              const risk = DANGEROUS_PERMISSIONS.find((d) => d.permission === p);
              if (risk?.severity === "critical") tags.push({ label: p, variant: "danger" });
            }
            const hasAllUrls = ext.hostPermissions.some(
              (p) => p === "<all_urls>" || p === "*://*/*" || p === "http://*/*" || p === "https://*/*"
            );
            if (hasAllUrls) tags.push({ label: "<all_urls>", variant: "danger" });
            if (ext.updateUrl && !ext.updateUrl.includes("google.com")) {
              tags.push({ label: "外部更新", variant: "danger" });
            }
            if (!ext.mayDisable) tags.push({ label: "削除不可", variant: "warning" });
            if (!ext.enabled) tags.push({ label: "無効", variant: "info" });
            if (ext.installType === "admin") tags.push({ label: "管理者", variant: "warning" });
            if (tags.length === 0) return <span style={{ color: colors.textMuted }}>-</span>;
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
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
                style={{ color: isDark ? "#60a5fa" : "#0070f3", fontSize: "12px" }}
              >
                {truncate(ext.homepageUrl, 25)}
              </a>
            ) : (
              <span style={{ color: colors.textMuted }}>-</span>
            ),
        },
        {
          key: "version",
          header: "バージョン",
          width: "80px",
          render: (ext) => <code style={{ fontSize: "11px" }}>{ext.version}</code>,
        },
      ]}
    />
  );
}
