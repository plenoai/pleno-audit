import type { ComponentType } from "preact";
import { useTheme, spacing, fontSize } from "../lib/theme";
import { Button } from "./Button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: ComponentType<{ size: number; style?: object }>;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px",
        textAlign: "center",
      }}
    >
      {Icon && (
        <Icon
          size={48}
          style={{
            color: colors.textMuted,
            opacity: 0.5,
            marginBottom: spacing.lg,
          }}
        />
      )}
      <div
        style={{
          fontSize: fontSize.lg,
          fontWeight: 500,
          color: colors.textSecondary,
          marginBottom: description || action ? spacing.sm : 0,
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: fontSize.md,
            color: colors.textMuted,
            marginBottom: action ? spacing.md : 0,
          }}
        >
          {description}
        </div>
      )}
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
