import { useEffect, useCallback, useState } from "preact/hooks";
import type { JSX } from "preact";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardNavOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * キーボードショートカット管理フック
 */
export function useKeyboardNav({ shortcuts, enabled = true }: UseKeyboardNavOptions) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // 入力フィールドでは無効化（特定のキー以外）
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable;

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
        const shiftMatch = !!shortcut.shift === e.shiftKey;
        const altMatch = !!shortcut.alt === e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          // 入力フィールドではEscapeとショートカットキーのみ許可
          if (isInput && !shortcut.ctrl && !shortcut.meta && shortcut.key !== "Escape") {
            continue;
          }

          e.preventDefault();
          shortcut.action();
          return;
        }
      }

      // ? でヘルプ表示
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShowHelp((prev) => !prev);
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return {
    showHelp,
    setShowHelp,
    shortcuts,
  };
}

/**
 * キーボードショートカットヘルプダイアログ
 */
export function KeyboardHelpDialog({
  shortcuts,
  onClose,
}: {
  shortcuts: KeyboardShortcut[];
  onClose: () => void;
}): JSX.Element {
  const formatKey = (shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];
    if (shortcut.ctrl || shortcut.meta) parts.push("⌘");
    if (shortcut.shift) parts.push("⇧");
    if (shortcut.alt) parts.push("⌥");
    parts.push(shortcut.key.toUpperCase());
    return parts.join(" + ");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          maxWidth: 480,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            キーボードショートカット
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: "var(--muted-foreground)",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shortcuts.map((shortcut, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <span style={{ color: "#374151", fontSize: 14 }}>
                {shortcut.description}
              </span>
              <kbd
                style={{
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  borderRadius: 4,
                  padding: "4px 8px",
                  fontSize: 12,
                  fontFamily: "monospace",
                  color: "#374151",
                }}
              >
                {formatKey(shortcut)}
              </kbd>
            </div>
          ))}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
            }}
          >
            <span style={{ color: "#374151", fontSize: 14 }}>
              このヘルプを表示
            </span>
            <kbd
              style={{
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
                fontFamily: "monospace",
                color: "#374151",
              }}
            >
              ?
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 標準的なダッシュボードショートカットを生成
 */
export function createDashboardShortcuts(options: {
  tabs: { id: string; label: string }[];
  onTabChange: (tab: string) => void;
  onRefresh: () => void;
  onSearch: () => void;
  onClearFilters: () => void;
}): KeyboardShortcut[] {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: "r",
      action: options.onRefresh,
      description: "データを更新",
    },
    {
      key: "/",
      action: options.onSearch,
      description: "検索にフォーカス",
    },
    {
      key: "Escape",
      action: options.onClearFilters,
      description: "フィルターをクリア",
    },
  ];

  // タブ切り替えショートカット (Ctrl+1~9)
  options.tabs.slice(0, 9).forEach((tab, i) => {
    shortcuts.push({
      key: String(i + 1),
      ctrl: true,
      action: () => options.onTabChange(tab.id),
      description: `${tab.label}タブに切り替え`,
    });
  });

  return shortcuts;
}
