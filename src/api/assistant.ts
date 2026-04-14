import { apiClient } from "@/api/client";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantContext {
  /** Current pathname (e.g. "/runs/abc-123/results"). */
  route?: string;
  /** Current run UUID if user is on a run page — backend will load defects/screens. */
  run_id?: string;
  /** Current scenario UUID if user is editing a scenario. */
  scenario_id?: string;
}

export interface AssistantChatResponse {
  answer: string;
}

export async function chatWithAssistant(
  messages: AssistantMessage[],
  context?: AssistantContext,
): Promise<AssistantChatResponse> {
  const { data } = await apiClient.post<AssistantChatResponse>(
    "/api/assistant/chat",
    { messages, context },
  );
  return data;
}
