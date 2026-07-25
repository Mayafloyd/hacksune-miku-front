import type {
  AgentStreamEvent,
  ChatRequest,
} from "../types/chat";

export const CHAT_API_ENDPOINT = "/api/chat";

export interface ChatTransportOptions {
  readonly signal?: AbortSignal;
}

/**
 * El componente de chat solo conoce esta interfaz. Cambiar el mock por HTTP no
 * requiere modificar presentación ni stores.
 */
export interface ChatTransport {
  readonly kind: "mock" | "http" | "custom";
  readonly endpoint: string;
  stream(
    request: ChatRequest,
    options?: ChatTransportOptions,
  ): AsyncIterable<AgentStreamEvent>;
}

