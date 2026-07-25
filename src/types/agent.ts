/**
 * Identificadores estables de los agentes. Mantener estos valores alineados
 * con el contrato POST /api/chat.
 */
export const AGENT_KINDS = ["sales", "support"] as const;

export type AgentKind = (typeof AGENT_KINDS)[number];

/**
 * Nombre orientado al consumo desde componentes y contratos públicos.
 * `AgentKind` se conserva como alias semántico interno.
 */
export type AgentType = AgentKind;

export type AgentAvailability =
  | "available"
  | "thinking"
  | "consulting"
  | "offline"
  | "error";

export interface AgentDefinition {
  readonly id: AgentKind;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly availability: AgentAvailability;
  readonly statusLabel: string;
  readonly quickActions: readonly string[];
}

export interface DemonstrationMetadata {
  /**
   * Los datos con este indicador son exclusivamente demostrativos y deben
   * sustituirse por información oficial antes de publicar.
   */
  readonly isDemonstration: true;
  readonly notice: string;
}

export const isAgentKind = (value: unknown): value is AgentKind =>
  typeof value === "string" &&
  (AGENT_KINDS as readonly string[]).includes(value);
