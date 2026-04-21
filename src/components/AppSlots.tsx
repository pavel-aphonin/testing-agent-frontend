import * as Icons from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Tooltip } from "antd";
import { useState } from "react";

import { listInstallations } from "@/api/apps";
import { AppRunner } from "@/components/AppRunner";
import { useWorkspaceStore } from "@/store/workspace";
import type { AppInstallationRead } from "@/types";

interface Props {
  slot: "sidebar" | "top_bar" | "corner" | "run_actions" | string;
  /** Only used for the corner slot — fixed positioning. */
  fixed?: boolean;
}

/**
 * Renders buttons for every enabled installation whose manifest.ui_slots
 * contains an entry matching ``slot``. Click → opens the iframe modal.
 *
 * Keeps its own modal state so multiple slot hosts on one page don't
 * trip over each other.
 */
export function AppSlots({ slot, fixed = false }: Props) {
  const ws = useWorkspaceStore((s) => s.current);
  const [active, setActive] = useState<{
    inst: AppInstallationRead;
    path: string;
  } | null>(null);

  const installedQ = useQuery({
    queryKey: ["ws-apps", ws?.id ?? "none"],
    queryFn: () => (ws ? listInstallations(ws.id) : Promise.resolve([])),
    enabled: Boolean(ws),
  });

  const entries = (installedQ.data ?? [])
    .filter((i) => i.is_enabled)
    .flatMap((i) => {
      const slots = i.version?.manifest?.ui_slots ?? [];
      return slots
        .filter((s) => s.slot === slot)
        .map((s) => ({ inst: i, slot: s }));
    });

  if (entries.length === 0) return null;

  const Buttons = entries.map(({ inst, slot: s }) => {
    const IconComp = (Icons as any)[`${s.icon ?? ""}`] ?? null;
    const btn = (
      <Button
        key={`${inst.id}:${s.slot}`}
        type={slot === "corner" ? "primary" : "text"}
        shape={slot === "corner" ? "round" : "default"}
        icon={IconComp ? <IconComp /> : null}
        onClick={() => setActive({ inst, path: s.path || "frontend/index.html" })}
        style={slot === "top_bar" ? { color: "#999" } : undefined}
      >
        {s.label}
      </Button>
    );
    return (
      <Tooltip
        key={`${inst.id}:${s.slot}`}
        title={inst.package?.name}
        placement={slot === "corner" ? "left" : "bottom"}
      >
        {btn}
      </Tooltip>
    );
  });

  if (fixed && slot === "corner") {
    return (
      <>
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 24,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {Buttons}
        </div>
        <AppRunner
          installation={active?.inst ?? null}
          slotPath={active?.path ?? null}
          onClose={() => setActive(null)}
        />
      </>
    );
  }

  return (
    <>
      {Buttons}
      <AppRunner
        installation={active?.inst ?? null}
        slotPath={active?.path ?? null}
        onClose={() => setActive(null)}
      />
    </>
  );
}
