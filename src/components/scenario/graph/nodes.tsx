/**
 * Custom React Flow node components for the scenario graph editor
 * (PER-82). Each node type renders with a distinct shape + colour so
 * the diagram reads at a glance, à la Lucidchart/Miro.
 *
 * Theming: every node pulls colours from AntD theme tokens. Brand
 * accents (#EE3424 etc.) are applied directly because they're tied to
 * Markov's identity rather than the dark/light palette.
 */

import {
  ArrowLeftOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Tag, Typography, theme } from "antd";

import type {
  ActionNodeData,
  ActionVerb,
  DecisionNodeData,
  LoopBackNodeData,
  ScreenCheckNodeData,
  SubScenarioNodeData,
  WaitNodeData,
} from "./types";

const ACTION_GLYPH: Record<ActionVerb, string> = {
  tap: "👆",
  input: "⌨️",
  swipe: "👉",
  wait: "⏳",
  assert: "✅",
  back: "↩",
};

// Handles need to be obviously grabbable — small dots were hard to
// aim at, and any CSS that messes with React Flow's own ``transform``
// breaks positioning. We bump the size and use box-shadow for the
// hover halo so the hit target stays exactly where it's drawn.
const HANDLE_STYLE = {
  width: 18,
  height: 18,
  background: "#EE3424",
  border: "3px solid #fff",
  boxShadow: "0 0 0 1.5px rgba(0,0,0,0.2)",
  cursor: "crosshair",
};

/** Four handles, one per side of the node. ReactFlow's
 *  ``connectionMode="loose"`` (set on the GraphEditor's <ReactFlow>)
 *  lets each ``type="source"`` handle also act as a connection target,
 *  so the user can drag an arrow IN or OUT from any side regardless
 *  of which end they grabbed first. Unique ids per side keep edge
 *  serialisation stable. */
function FourSidedHandles({ kind = "source" }: { kind?: "source" | "target" }) {
  return (
    <>
      <Handle id="t" type={kind} position={Position.Top} style={HANDLE_STYLE} />
      <Handle id="r" type={kind} position={Position.Right} style={HANDLE_STYLE} />
      <Handle id="b" type={kind} position={Position.Bottom} style={HANDLE_STYLE} />
      <Handle id="l" type={kind} position={Position.Left} style={HANDLE_STYLE} />
    </>
  );
}

// ─────────────────────────────────────── Start / End

// Start and End render as proper BPMN circles (not pills) — single
// shape per node so React Flow positions handles consistently. Icon
// on top, label below inside the circle in a small caption font.
const TERMINAL_SIZE = 84;

export function StartNode() {
  return (
    <div
      style={{
        width: TERMINAL_SIZE,
        height: TERMINAL_SIZE,
        borderRadius: "50%",
        background: "#52c41a",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.25)",
      }}
    >
      <PlayCircleOutlined style={{ fontSize: 22 }} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>
        Начало
      </span>
      {/* Source handles on every side — start emits, never receives. */}
      <FourSidedHandles kind="source" />
    </div>
  );
}

export function EndNode() {
  return (
    <div
      style={{
        width: TERMINAL_SIZE,
        height: TERMINAL_SIZE,
        borderRadius: "50%",
        background: "#ff4d4f",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        // BPMN convention: end terminator has a thicker ring so
        // it's distinguishable from start at a glance.
        boxShadow: "inset 0 0 0 4px rgba(255,255,255,0.3)",
      }}
    >
      <PoweroffOutlined style={{ fontSize: 22 }} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>
        Конец
      </span>
      {/* Target handles on every side — end receives, never emits. */}
      <FourSidedHandles kind="target" />
    </div>
  );
}

// ─────────────────────────────────────── Action (rectangle, default)

export function ActionNode({ data }: NodeProps) {
  const { token } = theme.useToken();
  const d = (data ?? {}) as ActionNodeData;
  const action = (d.action ?? "tap") as ActionVerb;
  const glyph = ACTION_GLYPH[action] ?? "•";

  return (
    <div
      style={{
        minWidth: 200,
        maxWidth: 280,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: token.boxShadowTertiary,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <FourSidedHandles kind="source" />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16 }}>{glyph}</span>
        <Tag color="processing" style={{ margin: 0, fontSize: 11 }}>
          {action}
        </Tag>
      </div>
      <Typography.Text strong style={{ fontSize: 13, lineHeight: 1.3 }}>
        {d.element_label || <em style={{ opacity: 0.6 }}>(не задан элемент)</em>}
      </Typography.Text>
      {d.value && (
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          = "{d.value.length > 36 ? d.value.slice(0, 36) + "…" : d.value}"
        </Typography.Text>
      )}
      {d.screen_description && (
        <Typography.Text type="secondary" style={{ fontSize: 10, fontStyle: "italic" }}>
          📍 {d.screen_description}
        </Typography.Text>
      )}
    </div>
  );
}

// ─────────────────────────────────────── Decision (diamond)

export function DecisionNode({ data }: NodeProps) {
  const { token } = theme.useToken();
  const d = (data ?? {}) as DecisionNodeData;
  // Diamond shape via rotated square + counter-rotated content. The
  // outer wrapper is the bounding box React Flow snaps handles to.
  return (
    <div
      style={{
        position: "relative",
        width: 160,
        height: 96,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Top + bottom handles for general drag-anywhere flow.
          ``connectionMode="loose"`` lets them act as either end of
          a connection. */}
      <Handle id="t" type="source" position={Position.Top} style={HANDLE_STYLE} />
      <Handle id="b" type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      <div
        style={{
          width: 96,
          height: 96,
          background: token.colorWarningBg,
          border: `2px solid ${token.colorWarning}`,
          transform: "rotate(45deg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            transform: "rotate(-45deg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            textAlign: "center",
            maxWidth: 110,
          }}
        >
          <QuestionCircleOutlined style={{ fontSize: 18, color: token.colorWarning }} />
          <Typography.Text strong style={{ fontSize: 11, lineHeight: 1.1 }}>
            {d.label || "Условие"}
          </Typography.Text>
        </div>
      </div>
      {/* Two source handles — left = false / "no", right = true / "yes".
          Edge conditions decide which one to take. */}
      <Handle
        id="false"
        type="source"
        position={Position.Left}
        style={{ ...HANDLE_STYLE, background: "#cf1322" }}
      />
      <Handle
        id="true"
        type="source"
        position={Position.Right}
        style={{ ...HANDLE_STYLE, background: "#52c41a" }}
      />
    </div>
  );
}

// ─────────────────────────────────────── Wait (oval)

export function WaitNode({ data }: NodeProps) {
  const { token } = theme.useToken();
  const d = (data ?? {}) as WaitNodeData;
  return (
    <div
      style={{
        minWidth: 140,
        height: 44,
        borderRadius: 22,
        background: token.colorInfoBg,
        border: `1px solid ${token.colorInfo}`,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <FourSidedHandles kind="source" />
      <ClockCircleOutlined style={{ color: token.colorInfo }} />
      <Typography.Text strong style={{ fontSize: 13 }}>
        Ждать {d.ms ?? 1000} мс
      </Typography.Text>
    </div>
  );
}

// ─────────────────────────────────────── Screen check (trapezoid)

export function ScreenCheckNode({ data }: NodeProps) {
  const { token } = theme.useToken();
  const d = (data ?? {}) as ScreenCheckNodeData;
  // Trapezoid via clip-path so the shape is a single element
  // (React Flow positions handles relative to the wrapper bbox).
  return (
    <div
      style={{
        position: "relative",
        width: 220,
        minHeight: 60,
        background: token.colorPrimaryBg,
        border: `1px solid ${token.colorPrimary}`,
        // Trapezoid: chamfer top corners
        clipPath: "polygon(12% 0, 88% 0, 100% 100%, 0 100%)",
        padding: "10px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <FourSidedHandles kind="source" />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <EyeOutlined style={{ color: token.colorPrimary }} />
        <Typography.Text strong style={{ fontSize: 12 }}>
          Проверить экран
        </Typography.Text>
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 11, textAlign: "center" }}>
        {d.screen_description || <em>(описание не задано)</em>}
      </Typography.Text>
    </div>
  );
}

// ─────────────────────────────────────── Loop-back

export function LoopBackNode({ data }: NodeProps) {
  const { token } = theme.useToken();
  const d = (data ?? {}) as LoopBackNodeData;
  return (
    <div
      style={{
        minWidth: 140,
        height: 50,
        borderRadius: 6,
        background: token.colorWarningBg,
        border: `2px dashed ${token.colorWarning}`,
        padding: "0 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <FourSidedHandles kind="source" />
      <ArrowLeftOutlined style={{ color: token.colorWarning }} />
      <Typography.Text strong style={{ fontSize: 12 }}>
        Повтор × {d.max_iterations ?? 10}
      </Typography.Text>
    </div>
  );
}

// ─────────────────────────────────────── Sub-scenario (rounded brick)

export function SubScenarioNode({ data }: NodeProps) {
  const { token } = theme.useToken();
  const d = (data ?? {}) as SubScenarioNodeData;
  // Use the info-bg token + double border to set the sub-scenario
  // visually apart. Brand purple-ish accent on the icon; falls back
  // to colorInfo if the variant doesn't exist in the token set.
  return (
    <div
      style={{
        minWidth: 200,
        maxWidth: 240,
        background: token.colorInfoBg,
        border: `2px double ${token.colorInfo}`,
        borderRadius: 12,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <FourSidedHandles kind="source" />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <LinkOutlined style={{ color: token.colorInfo }} />
        <Typography.Text strong style={{ fontSize: 12 }}>
          Связанный сценарий
        </Typography.Text>
      </div>
      <Typography.Text style={{ fontSize: 13 }}>
        {d.linked_scenario_title || (
          <em style={{ opacity: 0.6 }}>(не выбран)</em>
        )}
      </Typography.Text>
    </div>
  );
}

// ─────────────────────────────────────── Group (translucent container)

export function GroupNode({ data }: NodeProps) {
  const { token } = theme.useToken();
  const d = (data ?? {}) as { label?: string; width?: number; height?: number };
  return (
    <div
      style={{
        width: d.width ?? 320,
        height: d.height ?? 200,
        background: token.colorFillTertiary,
        border: `1px dashed ${token.colorBorder}`,
        borderRadius: 12,
        padding: "6px 10px",
        position: "relative",
      }}
    >
      <Typography.Text
        type="secondary"
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {d.label || "Группа"}
      </Typography.Text>
    </div>
  );
}

// Re-exported map consumed by ReactFlow's `nodeTypes` prop. Including
// here so any new node type only has to register in one place.
// eslint-disable-next-line react-refresh/only-export-components
export const SCENARIO_NODE_TYPES = {
  start: StartNode,
  end: EndNode,
  action: ActionNode,
  decision: DecisionNode,
  wait: WaitNode,
  screen_check: ScreenCheckNode,
  loop_back: LoopBackNode,
  sub_scenario: SubScenarioNode,
  group: GroupNode,
};

// Suppress "unused" warning on the imports of icons we expose for
// future use without rendering them yet.
void ThunderboltOutlined;
void CheckOutlined;
