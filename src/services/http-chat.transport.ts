import type {
  AgentResponse,
  AgentStreamEvent,
  ChatRequest,
} from "../types/chat";
import {
  CHAT_API_ENDPOINT,
  type ChatTransport,
  type ChatTransportOptions,
} from "./chat.transport";

export interface HttpChatTransportOptions {
  readonly endpoint?: string;
  readonly fetchImplementation?: typeof fetch;
  readonly headers?: Readonly<Record<string, string>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isAgentResponse = (value: unknown): value is AgentResponse =>
  isRecord(value) &&
  typeof value.id === "string" &&
  (value.agent === "sales" || value.agent === "support") &&
  typeof value.sessionId === "string" &&
  Array.isArray(value.blocks) &&
  typeof value.createdAt === "string";

const isAgentStreamEvent = (value: unknown): value is AgentStreamEvent => {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "start":
      return (
        typeof value.responseId === "string" &&
        (value.agent === "sales" || value.agent === "support") &&
        (value.status === "thinking" || value.status === "consulting")
      );
    case "text-delta":
      return (
        typeof value.responseId === "string" &&
        typeof value.delta === "string"
      );
    case "block":
      return typeof value.responseId === "string" && isRecord(value.block);
    case "done":
      return isAgentResponse(value.response);
    case "error":
      return (
        typeof value.code === "string" &&
        typeof value.message === "string" &&
        typeof value.retryable === "boolean"
      );
    default:
      return false;
  }
};

const parseEventLine = (line: string): AgentStreamEvent | undefined => {
  const trimmed = line.trim();
  if (
    trimmed.length === 0 ||
    trimmed.startsWith(":") ||
    trimmed.startsWith("event:")
  ) {
    return undefined;
  }

  const payload = trimmed.startsWith("data:")
    ? trimmed.slice(5).trim()
    : trimmed;
  if (payload === "[DONE]") return undefined;

  try {
    const parsed: unknown = JSON.parse(payload);
    return isAgentStreamEvent(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const errorEventForStatus = (
  status: number,
): Extract<AgentStreamEvent, { type: "error" }> => {
  if (status === 401 || status === 403) {
    return {
      type: "error",
      code: "session-expired",
      message:
        "Tu sesión venció. Inicia sesión nuevamente para continuar con esta conversación.",
      retryable: false,
    };
  }

  return {
    type: "error",
    code: "agent-error",
    message:
      "No pudimos completar la consulta. Tu conversación sigue guardada y puedes intentarlo nuevamente.",
    retryable: status >= 500 || status === 429,
  };
};

export class HttpChatTransport implements ChatTransport {
  readonly kind = "http" as const;
  readonly endpoint: string;

  private readonly fetchImplementation: typeof fetch;
  private readonly headers: Readonly<Record<string, string>>;

  constructor(options: HttpChatTransportOptions = {}) {
    this.endpoint = options.endpoint ?? CHAT_API_ENDPOINT;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.headers = options.headers ?? {};
  }

  async *stream(
    request: ChatRequest,
    options: ChatTransportOptions = {},
  ): AsyncIterable<AgentStreamEvent> {
    let response: Response;
    try {
      const requestInit: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/x-ndjson, application/json",
          ...this.headers,
        },
        body: JSON.stringify(request),
        ...(options.signal ? { signal: options.signal } : {}),
      };
      response = await this.fetchImplementation(
        this.endpoint,
        requestInit,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("[HACEB] No se pudo conectar con Jota", {
        endpoint: this.endpoint,
        error,
      });
      yield {
        type: "error",
        code: "offline",
        message:
          `No pudimos conectar con Jota en ${this.endpoint}. Verifica que la API esté ejecutándose.`,
        retryable: true,
      };
      return;
    }

    if (!response.ok) {
      yield errorEventForStatus(response.status);
      return;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload: unknown = await response.json();
      if (isAgentResponse(payload)) {
        yield { type: "done", response: payload };
      } else if (isAgentStreamEvent(payload)) {
        yield payload;
      } else {
        yield {
          type: "error",
          code: "invalid-request",
          message:
            "La respuesta del agente no tiene el formato esperado. Inténtalo nuevamente.",
          retryable: true,
        };
      }
      return;
    }

    if (!response.body) {
      yield {
        type: "error",
        code: "agent-error",
        message:
          "El agente no devolvió contenido. Puedes intentarlo nuevamente.",
        retryable: true,
      };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const event = parseEventLine(line);
          if (event) yield event;
        }
      }

      buffer += decoder.decode();
      const finalEvent = parseEventLine(buffer);
      if (finalEvent) yield finalEvent;
    } finally {
      reader.releaseLock();
    }
  }
}
