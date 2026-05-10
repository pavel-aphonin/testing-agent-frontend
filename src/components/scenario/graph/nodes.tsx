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

const HANDLE_STYLE = { width: 8, height: 8, background: "#EE3424" };

// ─────────────────────────────────────── Start / End

export function StartNode() {
  return (
    <div
      style={{
        width: 120,
        height: 44,
        borderRadius: 22,
        background: "#52c41a",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: 14,
        gap: 6,
      }}
    >
      <PlayCircleOutlined />
      Начало
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
    </div>
  );
}

export function EndNode() {
  return (
    <div
      style={{
        width: 120,
        height: 44,
        borderRadius: 22,
        background: "#ff4d4f",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: 14,
        gap: 6,
      }}
    >
      <PoweroffOutlined />
      Конец
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
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
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
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
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
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
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
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
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <ClockCircleOutlined style={{ color: token.colorInfo }} />
      <Typography.Text strong style={{ fontSize: 13 }}>
        Ждать {d.ms ?? 1000} мс
      </Typography.Text>
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
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
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <EyeOutlined style={{ color: token.colorPrimary }} />
        <Typography.Text strong style={{ fontSize: 12 }}>
          Проверить экран
        </Typography.Text>
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 11, textAlign: "center" }}>
        {d.screen_description || <em>(описание не задано)</em>}
      </Typography.Text>
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
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
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <ArrowLeftOutlined style={{ color: token.colorWarning }} />
      <Typography.Text strong style={{ fontSize: 12 }}>
        Повтор × {d.max_iterations ?? 10}
      </Typography.Text>
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
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
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
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
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
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
};

// Suppress "unused" warning on the imports of icons we expose for
// future use without rendering them yet.
void ThunderboltOutlined;
void CheckOutlined;
