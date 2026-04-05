import { useState, useEffect, useMemo } from "preact/hooks";
import { Badge, Button, LoadingState, ListRow, PagedList, ExpandedPanel, DetailRow, TabRoot, TagFilterBar, useExpandable, DetailOverflow, usePagination } from "../../../components";
import { useTabFilter } from "../hooks/useTabFilter";
import { useTagFilter } from "../hooks/useTagFilter";
import { useTheme, fontSize, spacing, borderRadius } from "../../../lib/theme";
import { createLogger } from "libztbs/extension-runtime";
import { getPermissionRiskLevel, DANGEROUS_PERMISSIONS, type PermissionRiskLevel, type PermissionRisk } from "libztbs/extension-analyzers";

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

function ExtensionRow({
  ext,
  isExpanded,
  onToggle,
}: {
  ext: ExtensionInfo;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const level = getPermissionRiskLevel(ext.permissions, ext.hostPermissions);
  const risk = getRiskLabel(level);
  const tags = getExtensionTags(ext);
  const allPerms = [...ext.permissions, ...ext.hostPermissions];

  return (
    <ListRow
      isHighlighted={isExpanded}
      onClick={onToggle}
      badges={
        <>
          <Badge variant={risk.variant} size="sm">{risk.text}</Badge>
          {tags.map((tag) => (
            <Badge key={tag.label} variant={tag.variant} size="sm">{tag.label}</Badge>
          ))}
        </>
      }
      title={
        <>
          {ext.icons?.[0]?.url && (
            <img src={ext.icons[0].url} alt="" style={{ width: "14px", height: "14px", flexShrink: 0 }} />
          )}
          <span>{ext.name}</span>
        </>
      }
      meta={<>v{ext.version} · {allPerms.length}個の権限</>}
      actions={
        <span
          style={{
            fontSize: fontSize.xs,
            color: colors.textMuted,
            transition: "transform 0.15s ease",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ▶
        </span>
      }
    />
  );
}

function getPermissionDescription(perm: string): string | undefined {
  const risk: PermissionRisk | undefined = DANGEROUS_PERMISSIONS.find((d) => d.permission === perm);
  return risk?.description;
}

function ExpandedDetails({ ext }: { ext: ExtensionInfo }) {
  const { colors } = useTheme();
  const allPerms = [...ext.permissions, ...ext.hostPermissions];
  const hasPerms = allPerms.length > 0;
  const hasHomepage = !!ext.homepageUrl;
  const koidexUrl = `https://dex.koi.security/reports/chrome/${ext.id}/${ext.version}`;

  if (!hasPerms && !hasHomepage) return null;

  const shown = allPerms.slice(0, 10);
  const remaining = allPerms.length - shown.length;

  return (
    <ExpandedPanel>
      <DetailRow>
        {hasHomepage && (
          <>
            <span style={{ color: colors.textMuted }}>HP:</span>
            <a
              href={ext.homepageUrl!}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: colors.link, textDecoration: "none" }}
              onClick={(e) => e.stopPropagation()}
            >
              {ext.homepageUrl!.length > 60 ? `${ext.homepageUrl!.slice(0, 60)}…` : ext.homepageUrl}
            </a>
          </>
        )}
        <a
          href={koidexUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            marginLeft: "auto",
            padding: `2px ${spacing.sm}`,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.sm,
            background: colors.bgPrimary,
            color: colors.link,
            fontSize: fontSize.sm,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          Koidex で調査 →
        </a>
      </DetailRow>
      {shown.map((perm) => {
        const isAllUrls = perm === "<all_urls>" || perm === "*://*/*";
        const isDangerous = DANGEROUS_PERMISSIONS.some((d) => d.permission === perm && d.severity === "critical");
        const description = getPermissionDescription(perm);
        return (
          <DetailRow key={perm} highlighted={isAllUrls || isDangerous}>
            {perm}
            {description && (
              <span style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                — {description}
              </span>
            )}
          </DetailRow>
        );
      })}
      <DetailOverflow remaining={remaining} />
    </ExpandedPanel>
  );
}

export function ExtensionsTab() {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { toggle: toggleExpand, isExpanded } = useExpandable();
  const { searchQuery, setSearchQuery, resetAll } = useTabFilter({});

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

  const { tagSummary, activeTagFilters, toggleTagFilter, resetTagFilters, filterByTags: tagFiltered } =
    useTagFilter(extensions, getExtensionTags);

  const filtered = useMemo(() => {
    let result = tagFiltered;
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
  }, [tagFiltered, searchQuery]);

  const { currentPage, setCurrentPage, totalPages, paged, pageSize } =
    usePagination(filtered, [searchQuery, activeTagFilters]);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <TabRoot>
      <TagFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="拡張機能名、権限で検索..."
        tagSummary={tagSummary}
        activeTagFilters={activeTagFilters}
        onToggleTag={toggleTagFilter}
      >
        <Button
          size="sm"
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: "chrome://extensions" })}
        >
          拡張機能を管理 ↗
        </Button>
      </TagFilterBar>

      <PagedList
        allCount={extensions.length}
        filteredCount={filtered.length}
        countLabel="拡張機能"
        emptyTitle="拡張機能が見つかりません"
        emptyDescription="インストールされた拡張機能が検出されると表示されます"
        noMatchTitle="一致する拡張機能がありません"
        onResetFilter={() => { resetAll(); resetTagFilters(); }}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      >
        {paged.map((ext) => (
          <div key={ext.id}>
            <ExtensionRow
              ext={ext}
              isExpanded={isExpanded(ext.id)}
              onToggle={() => toggleExpand(ext.id)}
            />
            {isExpanded(ext.id) && <ExpandedDetails ext={ext} />}
          </div>
        ))}
      </PagedList>
    </TabRoot>
  );
}
