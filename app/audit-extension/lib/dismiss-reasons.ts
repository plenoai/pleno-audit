import type { DismissReason } from "libztbs/alerts";

export interface DismissReasonOption {
  value: DismissReason;
  label: string;
  description: string;
}

export const DISMISS_REASON_OPTIONS: DismissReasonOption[] = [
  {
    value: "false_positive",
    label: "誤検知",
    description: "このアラートは実際のセキュリティリスクではない",
  },
  {
    value: "investigating",
    label: "対応中",
    description: "調査または対応を進めている",
  },
  {
    value: "wont_fix",
    label: "リスク受容",
    description: "リスクを認識した上で対応しない",
  },
];

export const DISMISS_REASON_LABELS: Record<
  DismissReason,
  { label: string; description: string }
> = Object.fromEntries(
  DISMISS_REASON_OPTIONS.map((option) => [
    option.value,
    { label: option.label, description: option.description },
  ]),
) as Record<DismissReason, { label: string; description: string }>;
