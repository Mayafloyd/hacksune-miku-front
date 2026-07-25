import type { DemonstrationMetadata } from "./agent";
import type { ProductCategory } from "./product";

export type WarrantyStatus =
  | "active"
  | "expired"
  | "not-found"
  | "verification-required";

export interface Warranty {
  readonly id: string;
  readonly productLabel: string;
  readonly model: string;
  readonly serialMasked: string;
  readonly status: WarrantyStatus;
  readonly statusLabel: string;
  readonly purchaseDate?: string;
  readonly coverageEndDate?: string;
  readonly coverageSummary: string;
  readonly nextAction?: string;
  readonly demo?: DemonstrationMetadata;
}

export interface IdentifiedProduct {
  readonly id: string;
  readonly category: ProductCategory;
  readonly typeLabel: string;
  readonly model: string;
  readonly serialMasked: string;
  readonly approximatePurchaseDate?: string;
  readonly warrantyStatus: WarrantyStatus;
  readonly manualAvailable: boolean;
  readonly demo?: DemonstrationMetadata;
}

export type DiagnosticStatus =
  | "not-started"
  | "in-progress"
  | "resolved"
  | "inconclusive"
  | "technician-required";

export type DiagnosticStepStatus =
  | "pending"
  | "current"
  | "completed"
  | "skipped";

export interface DiagnosticChoice {
  readonly id: "worked" | "continues" | "cannot-check";
  readonly label:
    | "Sí, funcionó"
    | "El problema continúa"
    | "No puedo verificarlo";
  readonly nextStepId?: string;
}

export interface DiagnosticStep {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly instruction: string;
  readonly safetyNote?: string;
  readonly status: DiagnosticStepStatus;
  readonly choices: readonly DiagnosticChoice[];
}

export interface DiagnosticCase {
  readonly id: string;
  readonly productType: string;
  readonly symptom: string;
  readonly status: DiagnosticStatus;
  readonly progress: number;
  readonly steps: readonly DiagnosticStep[];
  readonly escalationReason?: string;
  readonly demo?: DemonstrationMetadata;
}

export type SafetySeverity = "notice" | "warning" | "critical";

export interface SafetyAlert {
  readonly id: string;
  readonly severity: SafetySeverity;
  readonly title: string;
  readonly message: string;
  readonly actionLabel: string;
  readonly requiresProfessionalHelp: boolean;
}

export type ServiceRequestStatus =
  | "draft"
  | "submitted"
  | "scheduled"
  | "in-progress"
  | "completed"
  | "cancelled";

export interface ServiceRequestTimelineItem {
  readonly id: string;
  readonly label: string;
  readonly occurredAt: string;
  readonly completed: boolean;
}

export interface ServiceRequest {
  readonly id: string;
  readonly provisionalNumber: string;
  readonly productLabel: string;
  readonly model: string;
  readonly serviceType: string;
  readonly city: string;
  readonly addressMasked: string;
  readonly status: ServiceRequestStatus;
  readonly statusLabel: string;
  readonly contactName: string;
  readonly contactPhoneMasked: string;
  readonly createdAt: string;
  readonly timeline: readonly ServiceRequestTimelineItem[];
  readonly demo?: DemonstrationMetadata;
}

export type AppointmentAvailability =
  | "confirmed"
  | "pending"
  | "unavailable";

export interface ServiceAppointment {
  readonly id: string;
  readonly requestId: string;
  readonly provisionalNumber: string;
  readonly serviceType: string;
  readonly productLabel: string;
  readonly model: string;
  readonly city: string;
  readonly addressMasked: string;
  readonly date: string;
  readonly timeSlot: string;
  readonly contactName: string;
  readonly contactPhoneMasked: string;
  readonly availability: AppointmentAvailability;
  readonly statusLabel: string;
  readonly calendarTitle: string;
  readonly demo?: DemonstrationMetadata;
}
