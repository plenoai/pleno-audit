import { Lock } from "lucide-preact";
import { useTheme } from "../../../lib/theme";

interface LockedBannerProps {
  message?: string;
}

export function LockedBanner({ message = "この設定は組織によって管理されています" }: LockedBannerProps) {
  const { colors } = useTheme();

  const style = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 10px",
    background: colors.status?.warning?.bg || "#fef3c7",
    borderRadius: "6px",
    marginBottom: "8px",
  };

  const iconStyle = {
    fontSize: "12px",
  };

  const textStyle = {
    fontSize: "11px",
    color: colors.status?.warning?.text || "#92400e",
  };

  return (
    <div style={style}>
      <Lock size={12} />
      <span style={textStyle}>{message}</span>
    </div>
  );
}
