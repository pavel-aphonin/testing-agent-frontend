import { Card, Steps } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { TimelineEvent } from "@/components/EventsTimeline";
import type { RunStatus } from "@/types";

/**
 * PER-44: visual stepper for the simulator-boot phase of a run.
 *
 * The worker (testing-agent-explorer/explorer/worker.py:362-378) emits four
 * log-type events around the IOSSimulatorManager / AndroidEmulatorManager
 * lifecycle: "Creating simulator…" → "Booting …" → "Installing app…" →
 * "Launching app…". Each runs inside one opaque ``await`` so the user has
 * no visible feedback for ~30-90s — just a generic page spinner.
 *
 * This component watches the live event stream and lights up the matching
 * Steps card. We anchor on substring matches in the worker's English
 * messages because changing them would break the contract with this UI;
 * the worker side is documented to keep them stable.
 *
 * Hidden once the run leaves the boot phase (any event with step_idx > 0
 * means exploration started). Also hidden for runs that never touched the
 * V2 auto-provisioning path (the four messages simply never arrive).
 */

interface Props {
  events: TimelineEvent[];
  status: RunStatus;
}

type StageKey = "creating" | "booting" | "installing" | "launching";

const STAGE_ORDER: StageKey[] = ["creating", "booting", "installing", "launching"];

// Substring → stage. Ordered by detection priority — first match wins.
// Lowercased before matching so worker can vary capitalisation safely.
const STAGE_MATCHERS: { needle: string; stage: StageKey }[] = [
  { needle: "creating simulator", stage: "creating" },
  { needle: "booting", stage: "booting" },
  { needle: "installing app", stage: "installing" },
  { needle: "launching app", stage: "launching" },
];

export function BootProgress({ events, status }: Props) {
  const { t } = useTranslation();

  // The user only cares about the boot phase while we're still in it.
  // ``step_idx > 0`` on any event = exploration loop has started =
  // simulator is up and the four boot messages have all fired.
  const explorationStarted = useMemo(
    () => events.some((e) => (e.step_idx ?? 0) > 0),
    [events],
  );

  // Track which boot stages have been observed so the stepper can roll
  // forward as messages arrive. A stage is "seen" once any log message
  // contains its needle.
  const seenStages = useMemo(() => {
    const seen = new Set<StageKey>();
    for (const e of events) {
      if (e.type !== "log" || !e.message) continue;
      const msg = e.message.toLowerCase();
      for (const { needle, stage } of STAGE_MATCHERS) {
        if (msg.includes(needle)) {
          seen.add(stage);
          break;
        }
      }
    }
    return seen;
  }, [events]);

  // Stepper is only useful before the first exploration step + while the
  // run is in pending/running. After completion / failure / cancel we
  // hide it so the page doesn't show a frozen "in progress" stepper.
  if (explorationStarted) return null;
  if (status !== "pending" && status !== "running") return null;
  // Don't render an empty stepper before the first log arrives — the
  // page is already showing other "waiting" indicators.
  if (seenStages.size === 0) return null;

  // Find the highest reached stage; everything before it is "finish",
  // it itself is "process" (= AntD's pulsing-icon active state), and
  // everything after is "wait".
  const highestReachedIdx = STAGE_ORDER.reduce((acc, stage, idx) => {
    return seenStages.has(stage) ? idx : acc;
  }, -1);

  const items = STAGE_ORDER.map((stage, idx) => {
    let stepStatus: "wait" | "process" | "finish" = "wait";
    if (idx < highestReachedIdx) stepStatus = "finish";
    else if (idx === highestReachedIdx) stepStatus = "process";
    return {
      title: t(`bootProgress.steps.${stage}`),
      status: stepStatus,
    };
  });

  return (
    <Card
      size="small"
      title={t("bootProgress.title")}
      style={{ marginBottom: 16 }}
    >
      <Steps size="small" items={items} />
    </Card>
  );
}
