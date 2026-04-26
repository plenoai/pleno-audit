import type { ComponentChildren } from "preact";
import { useTheme } from "../lib/theme";

/**
 * enterprise の page-body flex:row パターン。
 * 左にリストペイン (固定幅)、右に詳細ペイン (flex:1) を並べる。
 *
 * 使い方:
 *   <HostPane>
 *     <HostListPane>...</HostListPane>
 *     <HostDetailPane>...</HostDetailPane>
 *   </HostPane>
 */

interface HostPaneProps {
  children: ComponentChildren;
}

export function HostPane({ children }: HostPaneProps) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

interface HostListPaneProps {
  children: ComponentChildren;
  /** デフォルト 540px (enterprise踏襲)。狭い画面用に上書き可。 */
  width?: number;
}

export function HostListPane({ children, width = 540 }: HostListPaneProps) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        width: `${width}px`,
        minWidth: `${width}px`,
        borderRight: `1px solid ${colors.border}`,
        background: colors.bgPrimary,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

interface HostDetailPaneProps {
  children: ComponentChildren;
}

export function HostDetailPane({ children }: HostDetailPaneProps) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        overflow: "auto",
        padding: "20px",
        background: colors.bgSecondary,
      }}
    >
      {children}
    </div>
  );
}

/**
 * リストペイン上部の chip filter 行 (Detection の chip 行に相当)。
 * 行間 padding: 10px 16px、border-bottom 区切り。
 */
export function HostListFilterBar({ children }: { children: ComponentChildren }) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: `1px solid ${colors.border}`,
        display: "flex",
        gap: "6px",
        alignItems: "center",
        flexWrap: "wrap",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

/** リストペイン本体スクロール領域 */
export function HostListBody({ children }: { children: ComponentChildren }) {
  return (
    <div
      style={{
        overflow: "auto",
        flex: 1,
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}
