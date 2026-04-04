import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  Info,
  Search,
  Zap,
  CheckCircle2,
  XCircle,
  LinkIcon,
} from 'lucide-react';
import AlertsLayout from './AlertsLayout';
import { ALL_PLAYBOOKS } from './data';
import type { PlaybookData, PlaybookSeverity } from './types';

const SEVERITY_CONFIG: Record<
  PlaybookSeverity,
  { label: string; bg: string; text: string; border: string }
> = {
  critical: {
    label: 'Critical',
    bg: 'bg-red-100 dark:bg-red-950',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-900',
  },
  high: {
    label: 'High',
    bg: 'bg-orange-100 dark:bg-orange-950',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-900',
  },
  medium: {
    label: 'Medium',
    bg: 'bg-yellow-100 dark:bg-yellow-950',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-900',
  },
  low: {
    label: 'Low',
    bg: 'bg-blue-100 dark:bg-blue-950',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-900',
  },
  info: {
    label: 'Info',
    bg: 'bg-gray-100 dark:bg-gray-900',
    text: 'text-gray-700 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-800',
  },
};

function SeverityBadge({ severity }: { severity: PlaybookSeverity }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text} border ${config.border}`}
    >
      {config.label}
    </span>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-[#171717] dark:text-[#ededed]">
        <Icon className="h-5 w-5 text-[#666] dark:text-[#8f8f8f]" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function PlaybookContent({ playbook }: { playbook: PlaybookData }) {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SeverityBadge severity={playbook.severity} />
          {playbook.mitreAttack?.map((id) => (
            <span
              key={id}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-mono bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#666] dark:text-[#8f8f8f] border border-[#eaeaea] dark:border-[#333]"
            >
              {id}
            </span>
          ))}
        </div>
        <p className="text-lg text-[#444] dark:text-[#aaa] leading-relaxed">
          {playbook.description}
        </p>
      </div>

      {/* Detection Logic */}
      <Section title="検知ロジック" icon={Search}>
        <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-[#fafafa] dark:bg-[#111] p-6 space-y-5">
          <div>
            <h3 className="text-sm font-medium text-[#666] dark:text-[#8f8f8f] mb-2">
              検知メカニズム
            </h3>
            <p className="text-[#171717] dark:text-[#ededed]">
              {playbook.detection.mechanism}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-[#666] dark:text-[#8f8f8f] mb-2">
              監視対象API
            </h3>
            <div className="flex flex-wrap gap-2">
              {playbook.detection.monitoredAPIs.map((api) => (
                <code
                  key={api}
                  className="px-2 py-1 rounded bg-[#171717] dark:bg-[#2a2a2a] text-[#ededed] text-sm font-mono"
                >
                  {api}
                </code>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-[#666] dark:text-[#8f8f8f] mb-2">
              発火条件
            </h3>
            <ul className="space-y-1">
              {playbook.detection.triggerConditions.map((cond, i) => (
                <li key={i} className="flex items-start gap-2 text-[#171717] dark:text-[#ededed]">
                  <Zap className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
                  {cond}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-[#666] dark:text-[#8f8f8f] mb-2">
              重大度判定ロジック
            </h3>
            <p className="text-[#171717] dark:text-[#ededed]">
              {playbook.detection.severityLogic}
            </p>
          </div>
        </div>
      </Section>

      {/* Response Playbook */}
      <Section title="インシデント対応プレイブック" icon={AlertTriangle}>
        <ol className="space-y-4">
          {playbook.response.map((step, i) => (
            <li
              key={i}
              className="flex gap-4 rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#111] p-5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#171717] text-sm font-bold">
                {i + 1}
              </div>
              <div>
                <h3 className="font-medium text-[#171717] dark:text-[#ededed]">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-[#666] dark:text-[#8f8f8f]">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Prevention */}
      <Section title="予防策" icon={Shield}>
        <ul className="space-y-2">
          {playbook.prevention.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[#171717] dark:text-[#ededed]">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </Section>

      {/* False Positives */}
      <Section title="誤検知について" icon={XCircle}>
        <p className="text-[#444] dark:text-[#aaa] leading-relaxed">
          {playbook.falsePositives}
        </p>
      </Section>

      {/* Related Alerts */}
      {playbook.relatedAlerts && playbook.relatedAlerts.length > 0 && (
        <Section title="関連アラート" icon={LinkIcon}>
          <div className="flex flex-wrap gap-2">
            {playbook.relatedAlerts.map((id) => {
              const related = ALL_PLAYBOOKS.find((p) => p.id === id);
              return related ? (
                <Link
                  key={id}
                  to={`/alerts/${id}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#171717] dark:text-[#ededed] hover:bg-[#eaeaea] dark:hover:bg-[#333] border border-[#eaeaea] dark:border-[#333] transition-colors"
                >
                  {related.title}
                </Link>
              ) : null;
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function NotFound() {
  return (
    <div className="text-center py-20">
      <Info className="h-12 w-12 mx-auto text-[#666] dark:text-[#8f8f8f] mb-4" />
      <h1 className="text-2xl font-medium text-[#171717] dark:text-[#ededed] mb-2">
        プレイブックが見つかりません
      </h1>
      <p className="text-[#666] dark:text-[#8f8f8f] mb-6">
        指定されたアラートIDに対応するプレイブックは存在しません。
      </p>
      <Link
        to="/alerts"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#171717] hover:opacity-90 transition-opacity"
      >
        <ArrowLeft className="h-4 w-4" />
        アラート一覧に戻る
      </Link>
    </div>
  );
}

export default function PlaybookPage() {
  const { alertId } = useParams<{ alertId: string }>();
  const playbook = ALL_PLAYBOOKS.find((p) => p.id === alertId);

  return (
    <AlertsLayout activeAlertId={alertId ?? null}>
      <motion.div
        key={alertId}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {playbook ? (
          <>
            <h1 className="text-3xl font-bold text-[#171717] dark:text-[#ededed] mb-6">
              {playbook.title}
            </h1>
            <PlaybookContent playbook={playbook} />
          </>
        ) : (
          <NotFound />
        )}
      </motion.div>
    </AlertsLayout>
  );
}
