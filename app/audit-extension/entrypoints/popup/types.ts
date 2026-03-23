import type { CSPViolation, NetworkRequest } from "@libztbs/csp";
import type { DetectedService } from "@libztbs/types";

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
