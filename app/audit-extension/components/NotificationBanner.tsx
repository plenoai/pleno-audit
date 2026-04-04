import { useState, useEffect } from "preact/hooks";
import { useTheme } from "../lib/theme";
import { AlertTriangle, ShieldAlert, Info, X, ExternalLink } from "lucide-preact";

export type NotificationSeverity = "critical" | "warning" | "info";

export interface Notification {
  id: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoDismiss?: number;
}

interface NotificationBannerProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  maxVisible?: number;
}

const severityConfig = {
  critical: {
    icon: ShieldAlert,
    bgColor: "#fef2f2",
    borderColor: "#ef4444",
    textColor: "#991b1b",
    darkBgColor: "#450a0a",
    darkTextColor: "#fecaca",
  },
  warning: {
    icon: AlertTriangle,
    bgColor: "#fffbeb",
    borderColor: "#f59e0b",
    textColor: "#92400e",
    darkBgColor: "#451a03",
    darkTextColor: "#fde68a",
  },
  info: {
    icon: Info,
    bgColor: "#eff6ff",
    borderColor: "#3b82f6",
    textColor: "#1e40af",
    darkBgColor: "#1e3a5f",
    darkTextColor: "#bfdbfe",
  },
};

function NotificationItem({
  notification,
  onDismiss,
  index,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
  index: number;
}) {
  const { isDark } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const config = severityConfig[notification.severity];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    if (notification.autoDismiss) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, notification.autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [notification.autoDismiss, notification.id]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(notification.id), 300);
  };

  const bgColor = isDark ? config.darkBgColor : config.bgColor;
  const textColor = isDark ? config.darkTextColor : config.textColor;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 8,
        border: `1px solid ${config.borderColor}`,
        background: bgColor,
        color: textColor,
        transform: isVisible && !isExiting ? "translateX(0)" : "translateX(100%)",
        opacity: isVisible && !isExiting ? 1 : 0,
        transition: "all 0.3s ease-out",
        marginBottom: 8,
      }}
    >
      <Icon size={20} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 4,
          }}
        >
          {notification.title}
        </div>
        <div
          style={{
            fontSize: 13,
            opacity: 0.9,
            lineHeight: 1.4,
          }}
        >
          {notification.message}
        </div>
        {notification.action && (
          <button
            onClick={notification.action.onClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: 8,
              padding: "4px 8px",
              fontSize: 12,
              fontWeight: 500,
              color: textColor,
              background: "transparent",
              border: `1px solid ${config.borderColor}`,
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            {notification.action.label}
            <ExternalLink size={12} />
          </button>
        )}
      </div>
      <button
        onClick={handleDismiss}
        style={{
          padding: 4,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          opacity: 0.6,
          color: textColor,
        }}
        aria-label="閉じる"
      >
        <X size={16} />
      </button>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: config.borderColor,
          borderRadius: "0 0 8px 8px",
          transform: notification.autoDismiss ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left",
          animation: notification.autoDismiss
            ? `shrink ${notification.autoDismiss}ms linear forwards`
            : undefined,
        }}
      />
    </div>
  );
}

export function NotificationBanner({
  notifications,
  onDismiss,
  maxVisible = 3,
}: NotificationBannerProps) {
  const visibleNotifications = notifications.slice(0, maxVisible);
  const hiddenCount = notifications.length - maxVisible;

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        width: 360,
        maxWidth: "calc(100vw - 32px)",
        zIndex: 1000,
      }}
    >
      <style>
        {`
          @keyframes shrink {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
          }
        `}
      </style>
      {visibleNotifications.map((notification, index) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
          index={index}
        />
      ))}
      {hiddenCount > 0 && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "var(--muted-foreground)",
            padding: 8,
          }}
        >
          他 {hiddenCount} 件の通知
        </div>
      )}
    </div>
  );
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (
    notification: Omit<Notification, "id" | "timestamp">
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
    return newNotification.id;
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    dismissNotification,
    clearAll,
  };
}
