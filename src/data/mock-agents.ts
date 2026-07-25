import type { AgentDefinition } from "../types/agent";

export const MOCK_AGENTS = {
  sales: {
    id: "sales",
    name: "Asesor de ventas",
    shortName: "Ventas",
    description:
      "Te ayuda a explorar y comparar opciones para tu hogar.",
    availability: "available",
    statusLabel: "Disponible",
    quickActions: [
      "Busco una nevera",
      "Quiero una lavadora",
      "Necesito una estufa",
      "Quiero comparar productos",
      "Explorar por espacio",
      "Conocer opciones de crédito",
    ],
  },
  support: {
    id: "support",
    name: "Experto técnico",
    shortName: "Soporte",
    description:
      "Te orienta con revisiones seguras, garantía y servicio técnico.",
    availability: "available",
    statusLabel: "Disponible",
    quickActions: [
      "Mi nevera no enfría",
      "Mi lavadora no inicia",
      "Consultar mi garantía",
      "Agendar una visita técnica",
      "Buscar un repuesto",
      "Consultar una solicitud",
      "Necesito mantenimiento",
      "Registrar mi producto",
    ],
  },
} as const satisfies Readonly<Record<"sales" | "support", AgentDefinition>>;

