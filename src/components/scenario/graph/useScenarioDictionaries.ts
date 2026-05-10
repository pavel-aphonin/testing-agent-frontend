/**
 * Pulls scenario-step option lists from the workspace's custom
 * dictionaries.
 *
 * Two well-known dictionary codes are recognised — admins can create
 * either through the regular Workspace → Dictionaries UI:
 *
 *   * ``scenario_actions`` — list of action verbs (codes are stable
 *     identifiers like ``tap``, the display name is whatever the
 *     admin puts into the dict item's name field).
 *   * ``ui_elements`` — common element labels (button names, field
 *     names…) used as autocomplete suggestions in action nodes.
 *
 * If a dictionary doesn't exist for the active workspace, the editor
 * falls back to its hard-coded defaults silently — no error, no UI
 * change. This keeps the editor functional for fresh workspaces and
 * lets admins add a dictionary when they're ready.
 */

import { useQuery } from "@tanstack/react-query";

import {
  listCustomDictionaries,
  listDictionaryItems,
} from "@/api/customDictionaries";

export interface DictItem {
  /** Stable id used in the saved scenario payload. */
  value: string;
  /** Human-readable label rendered in the picker / autocomplete. */
  label: string;
}

const ACTIONS_CODE = "scenario_actions";
const ELEMENTS_CODE = "ui_elements";

/** Fallback hard-coded action verbs — must match worker's _dispatch.
 *  Includes the same labels the GraphEditor used before this hook. */
export const FALLBACK_ACTIONS: DictItem[] = [
  { value: "tap", label: "👆 Нажать" },
  { value: "input", label: "⌨️ Ввести" },
  { value: "swipe", label: "👉 Свайп" },
  { value: "wait", label: "⏳ Ждать" },
  { value: "assert", label: "✅ Проверить" },
  { value: "back", label: "↩ Назад" },
];

/**
 * React Query-backed hook. Returns the option lists + a flag telling
 * the UI whether the source is the dictionary or the fallback so it
 * can show a small hint nudging admins toward Workspace → Dictionaries.
 *
 * Workspace id is required — without it we can't look up dicts. When
 * undefined the hook returns the fallback synchronously.
 */
export function useScenarioDictionaries(workspaceId: string | null | undefined) {
  const dictsQ = useQuery({
    queryKey: ["custom-dicts-for-scenarios", workspaceId ?? "none"],
    queryFn: () => listCustomDictionaries(workspaceId!),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  const actionsDict = (dictsQ.data ?? []).find((d) => d.code === ACTIONS_CODE);
  const elementsDict = (dictsQ.data ?? []).find((d) => d.code === ELEMENTS_CODE);

  const actionsItemsQ = useQuery({
    queryKey: ["custom-dict-items", actionsDict?.id],
    queryFn: () => listDictionaryItems(actionsDict!.id),
    enabled: Boolean(actionsDict?.id),
    staleTime: 60_000,
  });
  const elementsItemsQ = useQuery({
    queryKey: ["custom-dict-items", elementsDict?.id],
    queryFn: () => listDictionaryItems(elementsDict!.id),
    enabled: Boolean(elementsDict?.id),
    staleTime: 60_000,
  });

  const fromActions = (actionsItemsQ.data ?? [])
    .filter((it) => !it.is_group)
    .map<DictItem>((it) => ({
      value: it.code ?? it.id,
      label: it.name || it.code || it.id,
    }));

  const fromElements = (elementsItemsQ.data ?? [])
    .filter((it) => !it.is_group)
    .map<DictItem>((it) => ({
      value: it.code ?? it.name,
      label: it.name || it.code || "",
    }));

  return {
    /** Final action list — dictionary if filled, fallback otherwise. */
    actions: fromActions.length > 0 ? fromActions : FALLBACK_ACTIONS,
    /** Element-label suggestions — empty list if no dict + no items. */
    elements: fromElements,
    /** Did we actually find the dicts? Surfaced for the editor's hint. */
    hasActionsDict: fromActions.length > 0,
    hasElementsDict: fromElements.length > 0,
    /** Loading flag for any of the underlying queries. */
    isLoading:
      dictsQ.isLoading || actionsItemsQ.isLoading || elementsItemsQ.isLoading,
  };
}
