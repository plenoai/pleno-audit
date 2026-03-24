import { useTheme, fontSize } from "../lib/theme";
import { AlertCircle, RefreshCw, HelpCircle } from "lucide-preact";

export type ErrorType =
  | "connection"
  | "database"
  | "permission"
  | "timeout"
  | "unknown";

interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  technicalDetails?: string;
  onRetry?: () => void;
  onHelp?: () => void;
}

const errorConfig: Record<
  ErrorType,
  { title: string; message: string; icon: typeof AlertCircle }
> = {
  connection: {
    title: "接続エラー",
    message:
      "拡張機能との接続に失敗しました。ページを再読み込みしてください。",
    icon: AlertCircle,
  },
  database: {
    title: "データベースエラー",
    message:
      "データの読み込みに失敗しました。少し時間をおいてから再試行してください。",
    icon: AlertCircle,
  },
  permission: {
    title: "権限エラー",
    message:
      "必要な権限がありません。拡張機能の設定を確認してください。",
    icon: AlertCircle,
  },
  timeout: {
    title: "タイムアウト",
    message:
      "処理に時間がかかっています。しばらく待ってから再試行してください。",
    icon: AlertCircle,
  },
  unknown: {
    title: "エラーが発生しました",
    message:
      "予期しないエラーが発生しました。問題が続く場合はサポートにお問い合わせください。",
    icon: AlertCircle,
  },
};

export function ErrorState({
  type = "unknown",
  title,
  message,
  technicalDetails,
  onRetry,
  onHelp,
}: ErrorStateProps) {
  const { colors } = useTheme();
  const config = errorConfig[type];
  const Icon = config.icon;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
        textAlign: "center",
        maxWidth: 400,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "#fef2f2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <Icon size={32} color="#ef4444" />
      </div>

      <h2
        style={{
          fontSize: fontSize.xl,
          fontWeight: 600,
          color: colors.textPrimary,
          margin: 0,
          marginBottom: 8,
        }}
      >
        {title || config.title}
      </h2>

      <p
        style={{
          fontSize: fontSize.base,
          color: colors.textSecondary,
          margin: 0,
          marginBottom: 24,
          lineHeight: 1.6,
        }}
      >
        {message || config.message}
      </p>

      <div style={{ display: "flex", gap: 12 }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              fontSize: fontSize.base,
              fontWeight: 500,
              color: "#fff",
              background: colors.interactive,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={16} />
            再試行
          </button>
        )}
        {onHelp && (
          <button
            onClick={onHelp}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              fontSize: fontSize.base,
              fontWeight: 500,
              color: colors.textPrimary,
              background: "transparent",
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            <HelpCircle size={16} />
            ヘルプ
          </button>
        )}
      </div>

      {technicalDetails && (
        <details
          style={{
            marginTop: 24,
            width: "100%",
            textAlign: "left",
          }}
        >
          <summary
            style={{
              fontSize: fontSize.sm,
              color: colors.textSecondary,
              cursor: "pointer",
              marginBottom: 8,
            }}
          >
            技術的な詳細
          </summary>
          <pre
            style={{
              fontSize: fontSize.xs,
              color: colors.textSecondary,
              background: colors.bgTertiary,
              padding: 12,
              borderRadius: 6,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              margin: 0,
            }}
          >
            {technicalDetails}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * エラーメッセージをユーザーフレンドリーな形式に変換
 */
export function parseErrorMessage(error: unknown): {
  type: ErrorType;
  technicalDetails: string;
} {
  const errorString = error instanceof Error ? error.message : String(error);

  if (
    errorString.includes("timeout") ||
    errorString.includes("Timeout") ||
    errorString.includes("ready timeout")
  ) {
    return { type: "timeout", technicalDetails: errorString };
  }

  if (
    errorString.includes("permission") ||
    errorString.includes("Permission")
  ) {
    return { type: "permission", technicalDetails: errorString };
  }

  if (
    errorString.includes("database") ||
    errorString.includes("Database") ||
    errorString.includes("SQL") ||
    errorString.includes("storage")
  ) {
    return { type: "database", technicalDetails: errorString };
  }

  if (
    errorString.includes("connect") ||
    errorString.includes("Connection") ||
    errorString.includes("network") ||
    errorString.includes("fetch")
  ) {
    return { type: "connection", technicalDetails: errorString };
  }

  return { type: "unknown", technicalDetails: errorString };
}
