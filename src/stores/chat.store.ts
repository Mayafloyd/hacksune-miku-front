import { MOCK_CONVERSATIONS } from "../data/mock-conversations";
import type { AgentType } from "../types/agent";
import type {
  ChatMessage,
  Conversation,
  MessageFeedback,
} from "../types/chat";
import {
  createStore,
  type LightweightStore,
} from "./create-store";

export type ChatPhase =
  | "idle"
  | "loading"
  | "streaming"
  | "offline"
  | "error"
  | "empty"
  | "human-handoff"
  | "session-expired";

export interface ChatStoreError {
  readonly code:
    | "offline"
    | "agent-error"
    | "session-expired"
    | "invalid-request";
  readonly message: string;
  readonly retryable: boolean;
}

export interface ChatState {
  readonly activeAgent: AgentType;
  readonly conversations: readonly Conversation[];
  readonly activeConversationIdByAgent: Readonly<
    Record<AgentType, string | null>
  >;
  readonly drafts: Readonly<Record<AgentType, string>>;
  readonly phase: ChatPhase;
  readonly streamingText: string;
  readonly error: ChatStoreError | null;
  readonly historyOpen: boolean;
  readonly contextOpen: boolean;
}

export interface ChatStoreActions {
  selectAgent(agent: AgentType): void;
  selectConversation(conversationId: string): void;
  startConversation(agent?: AgentType, title?: string): Conversation;
  appendMessage(conversationId: string, message: ChatMessage): void;
  replaceMessage(conversationId: string, message: ChatMessage): void;
  clearActiveConversation(): void;
  setMessageFeedback(
    conversationId: string,
    messageId: string,
    feedback: MessageFeedback,
  ): void;
  setDraft(agent: AgentType, value: string): void;
  setPhase(phase: ChatPhase): void;
  setStreamingText(value: string): void;
  appendStreamingText(delta: string): void;
  setError(error: ChatStoreError | null): void;
  setHistoryOpen(open: boolean): void;
  setContextOpen(open: boolean): void;
  reset(): void;
}

export type ChatStore = LightweightStore<ChatState> &
  ChatStoreActions;

const initialConversationId = (
  agent: AgentType,
): string | null =>
  MOCK_CONVERSATIONS.find(
    (conversation) => conversation.agent === agent,
  )?.id ?? null;

const INITIAL_CHAT_STATE: ChatState = {
  activeAgent: "sales",
  conversations: MOCK_CONVERSATIONS,
  activeConversationIdByAgent: {
    sales: initialConversationId("sales"),
    support: initialConversationId("support"),
  },
  drafts: {
    sales: "",
    support: "",
  },
  phase: "idle",
  streamingText: "",
  error: null,
  historyOpen: false,
  contextOpen: false,
};

let conversationSequence = 0;

const createConversationId = (): string => {
  conversationSequence += 1;
  return `conversation-${Date.now()}-${conversationSequence}`;
};

const createEmptyConversation = (
  agent: AgentType,
  title: string,
): Conversation => {
  const createdAt = new Date().toISOString();
  const id = createConversationId();

  return {
    id,
    sessionId: `session-${id}`,
    agent,
    title,
    startedAt: createdAt,
    updatedAt: createdAt,
    group: "today",
    context:
      agent === "sales"
        ? {
            kind: "sales",
            priorities: [],
            savedProductIds: [],
            comparisonProductIds: [],
          }
        : {
            kind: "support",
            symptoms: [],
            attachmentIds: [],
          },
    messages: [],
  };
};

const updateConversation = (
  conversations: readonly Conversation[],
  conversationId: string,
  update: (conversation: Conversation) => Conversation,
): readonly Conversation[] =>
  conversations.map((conversation) =>
    conversation.id === conversationId
      ? update(conversation)
      : conversation,
  );

const baseStore = createStore(INITIAL_CHAT_STATE);

export const chatStore: ChatStore = {
  ...baseStore,
  selectAgent: (agent) => {
    baseStore.patch({
      activeAgent: agent,
      phase: "idle",
      streamingText: "",
      error: null,
    });
  },
  selectConversation: (conversationId) => {
    const conversation = baseStore
      .getState()
      .conversations.find(({ id }) => id === conversationId);
    if (!conversation) return;

    baseStore.patch((state) => ({
      activeAgent: conversation.agent,
      activeConversationIdByAgent: {
        ...state.activeConversationIdByAgent,
        [conversation.agent]: conversation.id,
      },
      phase: conversation.messages.length === 0 ? "empty" : "idle",
      streamingText: "",
      error: null,
      historyOpen: false,
    }));
  },
  startConversation: (agent, title = "Nueva conversación") => {
    const selectedAgent = agent ?? baseStore.getState().activeAgent;
    const conversation = createEmptyConversation(
      selectedAgent,
      title,
    );

    baseStore.patch((state) => ({
      activeAgent: selectedAgent,
      conversations: [conversation, ...state.conversations],
      activeConversationIdByAgent: {
        ...state.activeConversationIdByAgent,
        [selectedAgent]: conversation.id,
      },
      drafts: {
        ...state.drafts,
        [selectedAgent]: "",
      },
      phase: "empty",
      streamingText: "",
      error: null,
      historyOpen: false,
    }));

    return conversation;
  },
  appendMessage: (conversationId, message) => {
    baseStore.patch((state) => ({
      conversations: updateConversation(
        state.conversations,
        conversationId,
        (conversation) => ({
          ...conversation,
          updatedAt: message.createdAt,
          messages: [...conversation.messages, message],
        }),
      ),
    }));
  },
  replaceMessage: (conversationId, message) => {
    baseStore.patch((state) => ({
      conversations: updateConversation(
        state.conversations,
        conversationId,
        (conversation) => ({
          ...conversation,
          updatedAt: message.createdAt,
          messages: conversation.messages.map((currentMessage) =>
            currentMessage.id === message.id
              ? message
              : currentMessage,
          ),
        }),
      ),
    }));
  },
  clearActiveConversation: () => {
    const state = baseStore.getState();
    const conversationId =
      state.activeConversationIdByAgent[state.activeAgent];
    if (!conversationId) return;

    baseStore.patch({
      conversations: updateConversation(
        state.conversations,
        conversationId,
        (conversation) => ({
          ...conversation,
          updatedAt: new Date().toISOString(),
          messages: [],
        }),
      ),
      phase: "empty",
      streamingText: "",
      error: null,
    });
  },
  setMessageFeedback: (
    conversationId,
    messageId,
    feedback,
  ) => {
    baseStore.patch((state) => ({
      conversations: updateConversation(
        state.conversations,
        conversationId,
        (conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === messageId
              ? { ...message, feedback }
              : message,
          ),
        }),
      ),
    }));
  },
  setDraft: (agent, value) => {
    baseStore.patch((state) => ({
      drafts: {
        ...state.drafts,
        [agent]: value,
      },
    }));
  },
  setPhase: (phase) => {
    baseStore.patch({ phase });
  },
  setStreamingText: (streamingText) => {
    baseStore.patch({ streamingText });
  },
  appendStreamingText: (delta) => {
    baseStore.patch((state) => ({
      streamingText: `${state.streamingText}${delta}`,
    }));
  },
  setError: (error) => {
    baseStore.patch({
      error,
      phase:
        error?.code === "offline"
          ? "offline"
          : error?.code === "session-expired"
            ? "session-expired"
            : error
              ? "error"
              : "idle",
    });
  },
  setHistoryOpen: (historyOpen) => {
    baseStore.patch({ historyOpen });
  },
  setContextOpen: (contextOpen) => {
    baseStore.patch({ contextOpen });
  },
  reset: () => baseStore.reset(),
};

export const getActiveConversation = (
  state: ChatState = chatStore.getState(),
): Conversation | undefined => {
  const conversationId =
    state.activeConversationIdByAgent[state.activeAgent];
  return state.conversations.find(
    (conversation) => conversation.id === conversationId,
  );
};

