import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Shield, ArrowRight } from 'lucide-react';
import Footer from '../../components/Footer';
import { ALL_PLAYBOOKS, ALERT_GROUPS } from './data';
import type { PlaybookSeverity } from './types';

const SEVERITY_ORDER: PlaybookSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

const SEVERITY_STYLES: Record<PlaybookSeverity, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  info: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
};

export default function AlertsIndexPage() {
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeSeverity, setActiveSeverity] = useState<PlaybookSeverity | null>(null);

  const filtered = useMemo(() => {
    return ALL_PLAYBOOKS.filter((p) => {
      if (query) {
        const q = query.toLowerCase();
        if (
          !p.title.toLowerCase().includes(q) &&
          !p.id.toLowerCase().includes(q) &&
          !p.description.toLowerCase().includes(q)
        )
          return false;
      }
      if (activeGroup) {
        const group = ALERT_GROUPS.find((g) => g.id === activeGroup);
        if (group && !group.alertIds.includes(p.id)) return false;
      }
      if (activeSeverity && p.severity !== activeSeverity) return false;
      return true;
    });
  }, [query, activeGroup, activeSeverity]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0a0a0a]">
      <main className="flex-1 w-full px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="h-8 w-8 text-[#171717] dark:text-[#ededed]" />
            <h1 className="text-3xl font-bold text-[#171717] dark:text-[#ededed]">
              セキュリティアラート プレイブック
            </h1>
          </div>
          <p className="text-[#666] dark:text-[#8f8f8f] text-lg">
            {ALL_PLAYBOOKS.length}種類のセキュリティアラートの検知ロジックと対応手順
          </p>
        </div>

          {/* Filters */}
          <div className="space-y-4 mb-8">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666] dark:text-[#8f8f8f]" />
              <input
                type="text"
                placeholder="アラートを検索..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#111] text-[#171717] dark:text-[#ededed] placeholder-[#999] dark:placeholder-[#666] focus:outline-none focus:ring-2 focus:ring-[#171717] dark:focus:ring-[#ededed]"
              />
            </div>

            {/* Group filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveGroup(null)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeGroup === null
                    ? 'bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#171717]'
                    : 'bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#666] dark:text-[#8f8f8f] hover:bg-[#eaeaea] dark:hover:bg-[#333]'
                }`}
              >
                すべて
              </button>
              {ALERT_GROUPS.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setActiveGroup(activeGroup === group.id ? null : group.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeGroup === group.id
                      ? 'bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#171717]'
                      : 'bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#666] dark:text-[#8f8f8f] hover:bg-[#eaeaea] dark:hover:bg-[#333]'
                  }`}
                >
                  {group.label} ({group.alertIds.length})
                </button>
              ))}
            </div>

            {/* Severity filter */}
            <div className="flex flex-wrap gap-2">
              {SEVERITY_ORDER.map((sev) => {
                const count = ALL_PLAYBOOKS.filter((p) => p.severity === sev).length;
                if (count === 0) return null;
                return (
                  <button
                    key={sev}
                    onClick={() => setActiveSeverity(activeSeverity === sev ? null : sev)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                      activeSeverity === sev
                        ? `${SEVERITY_STYLES[sev]} border-transparent font-medium`
                        : 'bg-white dark:bg-[#111] text-[#666] dark:text-[#8f8f8f] border-[#eaeaea] dark:border-[#333] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a]'
                    }`}
                  >
                    {sev.charAt(0).toUpperCase() + sev.slice(1)} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results count */}
          <p className="text-sm text-[#666] dark:text-[#8f8f8f] mb-4">
            {filtered.length}件のアラート
          </p>

        {/* Alert cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((playbook) => (
            <Link
              key={playbook.id}
              to={`/alerts/${playbook.id}`}
              className="group flex flex-col rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#111] p-4 hover:border-[#171717] dark:hover:border-[#ededed] transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_STYLES[playbook.severity]}`}
                >
                  {playbook.severity}
                </span>
                <span className="text-xs font-mono text-[#999] dark:text-[#666] truncate">
                  {playbook.id}
                </span>
              </div>
              <h3 className="font-medium text-sm text-[#171717] dark:text-[#ededed] line-clamp-1">
                {playbook.title}
              </h3>
              <p className="text-xs text-[#666] dark:text-[#8f8f8f] line-clamp-2 mt-1">
                {playbook.description}
              </p>
            </Link>
          ))}
        </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
