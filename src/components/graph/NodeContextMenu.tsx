import { Menu, theme } from "antd";
import type { CSSProperties } from "react";

/**
 * Floating context menu rendered next to a graph node on right-click
 * (PER-42). Stays UI-only — actual menu items are injected by the
 * page that hosts the graph (RunResults), so different pages can
 * expose different actions on the same renderer.
 */

export interface NodeContextMenuItem {
  key: string;
  label: string;
  /** Receives the screen hash the menu was opened for. */
  onClick: (screenHash: string) => void;
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  /** Pointer position in viewport coords (returned by the renderer). */
  anchor: { x: number; y: number };
  screenHash: string;
  items: NodeContextMenuItem[];
  onClose: () => void;
}

export function NodeContextMenu({ anchor, screenHash, items, onClose }: Props) {
  const { token } = theme.useToken();
  // Pinned to the viewport so it doesn't follow scroll — same as
  // native context menus. Z-index above antd Drawer (1000 default)
  // so right-click still works when a drawer is open.
  const style: CSSProperties = {
    position: "fixed",
    top: anchor.y,
    left: anchor.x,
    zIndex: 1100,
    boxShadow: token.boxShadowSecondary,
    borderRadius: 6,
    background: token.colorBgElevated,
  };

  // Empty items list = render nothing (renderer can pass [] when the
  // host page doesn't want a menu).
  if (items.length === 0) return null;

  return (
    <div style={style} onClick={onClose}>
      <Menu
        items={items.map((it) => ({
          key: it.key,
          label: it.label,
          danger: it.danger,
          disabled: it.disabled,
          onClick: () => {
            it.onClick(screenHash);
            onClose();
          },
        }))}
      />
    </div>
  );
}
