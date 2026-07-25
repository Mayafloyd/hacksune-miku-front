import type {
  AgentAvailability,
  AgentKind,
  DemonstrationMetadata,
} from "./agent";
import type {
  Product,
  ProductCategory,
  ProductComparison,
} from "./product";
import type {
  DiagnosticCase,
  ServiceAppointment,
  ServiceRequest,
  SafetyAlert,
  Warranty,
} from "./support";

export type MessageAuthor = "user" | "agent" | "system";
export type MessageDeliveryStatus =
  | "sending"
  | "streaming"
  | "sent"
  | "failed";
export type MessageFeedback = "positive" | "negative" | null;

export interface ChatAttachment {
  readonly id: string;
  readonly name: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly previewUrl?: string;
  readonly uploadStatus: "pending" | "uploading" | "ready" | "invalid" | "error";
  readonly errorMessage?: string;
}

export interface MessageSource {
  readonly id: string;
  readonly label: string;
  readonly url?: string;
  readonly kind: "manual" | "catalog" | "warranty" | "service-request";
}

export interface MessageAction {
  readonly id: string;
  readonly label: string;
  readonly intent: string;
  readonly emphasis?: "primary" | "secondary" | "danger";
}

interface ResponseBlockBase {
  readonly id: string;
}

export interface TextBlock extends ResponseBlockBase {
  readonly type: "text";
  readonly text: string;
}

export interface ProductListBlock extends ResponseBlockBase {
  readonly type: "product-list";
  readonly title: string;
  readonly products: readonly Product[];
  readonly emptyMessage?: string;
}

export interface ProductComparisonBlock extends ResponseBlockBase {
  readonly type: "product-comparison";
  readonly title: string;
  readonly products: readonly Product[];
  readonly comparison: ProductComparison;
}

export interface DiagnosticBlock extends ResponseBlockBase {
  readonly type: "diagnostic";
  readonly diagnostic: DiagnosticCase;
}

export interface SafetyAlertBlock extends ResponseBlockBase {
  readonly type: "safety-alert";
  readonly alert: SafetyAlert;
}

export interface WarrantyBlock extends ResponseBlockBase {
  readonly type: "warranty";
  readonly warranty: Warranty;
}

export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "select"
  | "date"
  | "time-slot"
  | "textarea"
  | "checkbox";

export interface FormOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface FormField {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly type: FormFieldType;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly options?: readonly FormOption[];
  readonly helpText?: string;
  readonly value?: string | boolean;
}

export interface FormBlock extends ResponseBlockBase {
  readonly type: "form";
  readonly title: string;
  readonly description?: string;
  readonly fields: readonly FormField[];
  readonly submitLabel: string;
}

export interface AppointmentBlock extends ResponseBlockBase {
  readonly type: "appointment";
  readonly appointment: ServiceAppointment;
  readonly request?: ServiceRequest;
}

export interface HumanHandoffBlock extends ResponseBlockBase {
  readonly type: "human-handoff";
  readonly title: string;
  readonly message: string;
  readonly status: "offered" | "requested" | "connected" | "unavailable";
  readonly actionLabel: string;
}

export type AgentResponseBlock =
  | TextBlock
  | ProductListBlock
  | ProductComparisonBlock
  | DiagnosticBlock
  | SafetyAlertBlock
  | WarrantyBlock
  | FormBlock
  | AppointmentBlock
  | HumanHandoffBlock;

export interface ChatMessage {
  readonly id: string;
  readonly agent: AgentKind;
  readonly author: MessageAuthor;
  readonly authorLabel: string;
  readonly createdAt: string;
  readonly content: string;
  readonly blocks?: readonly AgentResponseBlock[];
  readonly attachments?: readonly ChatAttachment[];
  readonly sources?: readonly MessageSource[];
  readonly actions?: readonly MessageAction[];
  readonly deliveryStatus: MessageDeliveryStatus;
  readonly feedback?: MessageFeedback;
}

export interface SalesConversationContext {
  readonly kind: "sales";
  readonly category?: ProductCategory;
  readonly householdSize?: number;
  readonly budgetLabel?: string;
  readonly priorities: readonly string[];
  readonly savedProductIds: readonly string[];
  readonly comparisonProductIds: readonly string[];
  readonly recommendedProductId?: string;
}

export interface SupportConversationContext {
  readonly kind: "support";
  readonly identifiedProductId?: string;
  readonly symptoms: readonly string[];
  readonly warrantyId?: string;
  readonly diagnosticId?: string;
  readonly serviceRequestId?: string;
  readonly attachmentIds: readonly string[];
}

export type ConversationContext =
  | SalesConversationContext
  | SupportConversationContext;

export type ConversationGroup = "today" | "this-week" | "previous";

export interface Conversation {
  readonly id: string;
  readonly sessionId: string;
  readonly agent: AgentKind;
  readonly title: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly group: ConversationGroup;
  readonly context: ConversationContext;
  readonly messages: readonly ChatMessage[];
  readonly demo?: DemonstrationMetadata;
}

/**
 * Contrato JSON inicial para POST /api/chat.
 */
export interface ChatRequest {
  readonly agent: AgentKind;
  readonly sessionId: string;
  readonly message: string;
  readonly productContext: {
    readonly productId?: string;
    readonly category?: ProductCategory;
    readonly model?: string;
    readonly [key: string]: unknown;
  };
  readonly attachments: readonly ChatAttachment[];
}

export interface AgentResponse {
  readonly id: string;
  readonly agent: AgentKind;
  readonly sessionId: string;
  readonly blocks: readonly AgentResponseBlock[];
  readonly createdAt: string;
}

export type AgentStreamEvent =
  | {
      readonly type: "start";
      readonly responseId: string;
      readonly agent: AgentKind;
      readonly status: Extract<AgentAvailability, "thinking" | "consulting">;
    }
  | {
      readonly type: "text-delta";
      readonly responseId: string;
      readonly delta: string;
    }
  | {
      readonly type: "block";
      readonly responseId: string;
      readonly block: AgentResponseBlock;
    }
  | {
      readonly type: "done";
      readonly response: AgentResponse;
    }
  | {
      readonly type: "error";
      readonly responseId?: string;
      readonly code:
        | "offline"
        | "agent-error"
        | "session-expired"
        | "invalid-request";
      readonly message: string;
      readonly retryable: boolean;
    };

export interface DemoConversationFixture {
  readonly conversations: readonly Conversation[];
  readonly demo: DemonstrationMetadata;
}
