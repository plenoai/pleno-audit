import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ChevronRight, X, ArrowLeft } from 'lucide-react';
import { ALERT_GROUPS, ALL_PLAYBOOKS } from './data';
import type { PlaybookSeverity } from './types';

const SEVERITY_DOT: Record<PlaybookSeverity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-gray-400',
};

interface AlertSidebarProps {
  activeAlertId: string | null;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export default function AlertSidebar({
  activeAlertId,
  isMobileOpen,
  onMobileClose,
}: AlertSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => {
      if (!activeAlertId) return new Set<string>();
      const group = ALERT_GROUPS.find((g) => g.alertIds.includes(activeAlertId));
      return group ? new Set([group.id]) : new Set<string>();
    }
  );

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-white dark:bg-[#0a0a0a] border-r border-[#eaeaea] dark:border-[#333] z-50
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#eaeaea] dark:border-[#333]">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#171717] dark:text-[#ededed]" />
            <span className="font-medium text-[#171717] dark:text-[#ededed]">
              Pleno Audit
            </span>
          </Link>
          <button
            onClick={onMobileClose}
            className="lg:hidden p-2 rounded-lg hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a]"
          >
            <X className="h-5 w-5 text-[#666] dark:text-[#8f8f8f]" />
          </button>
        </div>

        <div className="p-4 border-b border-[#eaeaea] dark:border-[#333]">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-[#666] dark:text-[#8f8f8f] hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>ホームに戻る</span>
          </Link>
        </div>

        <nav className="p-4 overflow-y-auto h-[calc(100%-120px)]">
          {/* All alerts link */}
          <Link
            to="/alerts"
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-2 transition-colors
              ${activeAlertId === null
                ? 'bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#171717] dark:text-[#ededed] font-medium'
                : 'text-[#666] dark:text-[#8f8f8f] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a]'
              }
            `}
          >
            <Shield className="h-4 w-4" />
            全アラート一覧
          </Link>

          <div className="h-px bg-[#eaeaea] dark:bg-[#333] my-3" />

          <ul className="space-y-1">
            {ALERT_GROUPS.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const hasActiveChild = group.alertIds.includes(activeAlertId ?? '');

              return (
                <li key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                      ${hasActiveChild
                        ? 'text-[#171717] dark:text-[#ededed] font-medium'
                        : 'text-[#666] dark:text-[#8f8f8f] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] hover:text-[#171717] dark:hover:text-[#ededed]'
                      }
                    `}
                  >
                    <span>{group.label}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-[#999] dark:text-[#666]">
                        {group.alertIds.length}
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </button>

                  {isExpanded && (
                    <ul className="mt-1 ml-3 space-y-0.5">
                      {group.alertIds.map((alertId) => {
                        const playbook = ALL_PLAYBOOKS.find((p) => p.id === alertId);
                        if (!playbook) return null;
                        const isActive = activeAlertId === alertId;

                        return (
                          <li key={alertId}>
                            <Link
                              to={`/alerts/${alertId}`}
                              onClick={onMobileClose}
                              className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
                                ${isActive
                                  ? 'bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#171717] dark:text-[#ededed] font-medium'
                                  : 'text-[#666] dark:text-[#8f8f8f] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a]'
                                }
                              `}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${SEVERITY_DOT[playbook.severity]}`} />
                              <span className="truncate">{playbook.title}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
