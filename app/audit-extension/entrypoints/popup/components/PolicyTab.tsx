import type { CSPViolation } from "@libztbs/csp";
import { PolicyGenerator } from "./PolicyGenerator";
import { DetectionSettings } from "./DetectionSettings";
import { CSPSettings } from "./CSPSettings";
import { DoHSettings } from "./DoHSettings";
import { NetworkMonitorSettings } from "./NetworkMonitorSettings";
import { EnterprisePolicyStatus } from "./EnterprisePolicyStatus";
import { usePopupStyles } from "../styles";

interface PolicyTabProps {
  violations: CSPViolation[];
}

export function PolicyTab({ violations }: PolicyTabProps) {
  const styles = usePopupStyles();

  return (
    <div style={styles.tabContent}>
      {/* CSP Policy Generator - only show if there are violations */}
      {violations.length > 0 && (
        <div>
          <PolicyGenerator />
        </div>
      )}

      {/* Detection Settings */}
      <DetectionSettings />

      {/* CSP Settings */}
      <CSPSettings />

      {/* DoH Settings */}
      <DoHSettings />

      {/* Network Monitor Settings */}
      <NetworkMonitorSettings />

      {/* Enterprise Policy Status */}
      <EnterprisePolicyStatus />
    </div>
  );
}
