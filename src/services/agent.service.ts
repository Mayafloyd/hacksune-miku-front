import { isAgentKind } from "../types/agent";
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
import {
  HttpChatTransport,
  type HttpChatTransportOptions,
} from "./http-chat.transport";
import {
  MockChatTransport,
  type MockChatTransportOptions,
} from "./mock-chat.transport";

export type AgentServiceMode = "mock" | "http";

export interface AgentServiceOptions {
  readonly mode?: AgentServiceMode;
  readonly transport?: ChatTransport;
  readonly http?: HttpChatTransportOptions;
  readonly mock?: MockChatTransportOptions;
}

export class AgentServiceError extends Error {
  readonly code: Extract<
    AgentStreamEvent,
    { type: "error" }
  >["code"];
  readonly retryable: boolean;

  constructor(
    code: AgentServiceError["code"],
    message: string,
    retryable: boolean,
  ) {
    super(message);
    this.name = "AgentServiceError";
    this.code = code;
    this.retryable = retryable;
  }
}

const invalidRequestEvent = (
  message: string,
): Extract<AgentStreamEvent, { type: "error" }> => ({
  type: "error",
  code: "invalid-request",
  message,
  retryable: false,
});

const validateRequest = (
  request: ChatRequest,
): Extract<AgentStreamEvent, { type: "error" }> | undefined => {
  if (!isAgentKind(request.agent)) {
    return invalidRequestEvent("Selecciona un agente válido para continuar.");
  }
  if (request.sessionId.trim().length === 0) {
    return invalidRequestEvent(
      "No encontramos una sesión activa. Crea una conversación nueva.",
    );
  }
  if (request.message.trim().length === 0) {
    return invalidRequestEvent("Escribe un mensaje antes de enviarlo.");
  }
  if (!Array.isArray(request.attachments)) {
    return invalidRequestEvent(
      "No pudimos leer los archivos adjuntos. Revísalos e inténtalo nuevamente.",
    );
  }
  return undefined;
};

export class AgentService {
  readonly endpoint: string;

  constructor(private readonly transport: ChatTransport) {
    this.endpoint = transport.endpoint;
  }

  async *stream(
    request: ChatRequest,
    options: ChatTransportOptions = {},
  ): AsyncIterable<AgentStreamEvent> {
    const validationError = validateRequest(request);
    if (validationError) {
      yield validationError;
      return;
    }

    yield* this.transport.stream(request, options);
  }

  /**
   * Utilidad para consumidores que todavía no procesan streaming. Las nuevas
   * interfaces deberían preferir `stream`.
   */
  async send(
    request: ChatRequest,
    options: ChatTransportOptions = {},
  ): Promise<AgentResponse> {
    for await (const event of this.stream(request, options)) {
      if (event.type === "done") return event.response;
      if (event.type === "error") {
        throw new AgentServiceError(
          event.code,
          event.message,
          event.retryable,
        );
      }
    }

    throw new AgentServiceError(
      "agent-error",
      "El agente no completó la respuesta. Puedes intentarlo nuevamente.",
      true,
    );
  }
}

export const createAgentService = (
  options: AgentServiceOptions = {},
): AgentService => {
  if (options.transport) return new AgentService(options.transport);

  const mode = options.mode ?? "mock";
  const transport: ChatTransport =
    mode === "http"
      ? new HttpChatTransport({
            endpoint: CHAT_API_ENDPOINT,
            ...options.http,
        })
      : new MockChatTransport(options.mock);

  return new AgentService(transport);
};

/**
 * Desarrollo local: usa fixtures demostrativos.
 * Producción: `PUBLIC_USE_MOCK_AGENTS=false` activa el transporte HTTP.
 */
const useMockAgents =
  import.meta.env.PUBLIC_USE_MOCK_AGENTS !== "false";
const configuredApiBase =
  import.meta.env.PUBLIC_AGENT_API_URL?.trim().replace(/\/+$/, "") ??
  "";
const configuredEndpoint = configuredApiBase
  ? `${configuredApiBase}/api/chat`
  : CHAT_API_ENDPOINT;

export const agentService = useMockAgents
  ? createAgentService({ mode: "mock" })
  : createAgentService({
      mode: "http",
      http: { endpoint: configuredEndpoint },
    });
