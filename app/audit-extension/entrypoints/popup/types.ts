import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { DetectedService } from "@pleno-audit/casb-types";

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
}

export interface PolicyTabProps extends ViolationProps {}
