import { apiClient } from "@/api/client";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantChatResponse {
  answer: string;
}

export async function chatWithAssistant(
  messages: AssistantMessage[],
): Promise<AssistantChatResponse> {
  const { data } = await apiClient.post<AssistantChatResponse>(
    "/api/assistant/chat",
    { messages },
  );
  return data;
}
