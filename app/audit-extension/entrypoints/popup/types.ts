import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { DetectedService } from "@pleno-audit/casb-types";
import type { CapturedAIPrompt } from "@pleno-audit/ai-detector";
import type { DoHRequestRecord } from "@pleno-audit/extension-runtime";

export interface ViolationProps {
  violations: CSPViolation[];
}

export interface ServiceProps {
  services: DetectedService[];
}

export interface ServiceTabProps extends ServiceProps, ViolationProps {
  networkRequests: NetworkRequest[];
}

export interface EventTabProps extends ServiceProps, ViolationProps {
  networkRequests: NetworkRequest[];
  aiPrompts: CapturedAIPrompt[];
  doHRequests: DoHRequestRecord[];
}

export interface PolicyTabProps extends ViolationProps {}
