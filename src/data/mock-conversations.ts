import type { Conversation } from "../types/chat";
import { DEMO_METADATA } from "./demo";
import {
  MOCK_PRODUCT_COMPARISON,
  MOCK_PRODUCTS,
} from "./mock-products";
import {
  MOCK_APPOINTMENTS,
  MOCK_DIAGNOSTICS,
  MOCK_SERVICE_REQUESTS,
  MOCK_WARRANTIES,
} from "./mock-support";

/**
 * HISTORIAL EXCLUSIVAMENTE DEMOSTRATIVO.
 * Los nombres, fechas, sesiones y casos no corresponden a personas reales.
 */
export const MOCK_CONVERSATIONS = [
  {
    id: "demo-conversation-sales-refrigerator",
    sessionId: "demo-session-sales-001",
    agent: "sales",
    title: "Nevera para familia de cuatro",
    startedAt: "2026-07-25T09:12:00-05:00",
    updatedAt: "2026-07-25T09:18:00-05:00",
    group: "today",
    context: {
      kind: "sales",
      category: "refrigerator",
      householdSize: 4,
      budgetLabel: "Por definir",
      priorities: ["Capacidad", "Espacio interior"],
      savedProductIds: ["demo-refrigerator-420"],
      comparisonProductIds: [
        "demo-refrigerator-420",
        "demo-refrigerator-300",
      ],
      recommendedProductId: "demo-refrigerator-420",
    },
    messages: [
      {
        id: "demo-message-sales-001-user",
        agent: "sales",
        author: "user",
        authorLabel: "Tú",
        createdAt: "2026-07-25T09:12:00-05:00",
        content:
          "Busco una nevera para cuatro personas. Tengo 72 cm de ancho disponibles.",
        deliveryStatus: "sent",
      },
      {
        id: "demo-message-sales-001-agent",
        agent: "sales",
        author: "agent",
        authorLabel: "Asesor de ventas",
        createdAt: "2026-07-25T09:12:08-05:00",
        content:
          "Encontré dos ejemplos para comparar. La opción de 420 L cabe en el ancho que indicaste, pero conviene validar también alto, fondo y ventilación.",
        blocks: [
          {
            id: "demo-block-sales-intro",
            type: "text",
            text: "Estas referencias son demostrativas. Confirmaremos especificaciones, precio e inventario cuando se conecte el catálogo oficial.",
          },
          {
            id: "demo-block-sales-products",
            type: "product-list",
            title: "Opciones para revisar",
            products: [MOCK_PRODUCTS[0], MOCK_PRODUCTS[1]],
          },
          {
            id: "demo-block-sales-comparison",
            type: "product-comparison",
            title: "Comparación inicial",
            products: [MOCK_PRODUCTS[0], MOCK_PRODUCTS[1]],
            comparison: MOCK_PRODUCT_COMPARISON,
          },
        ],
        actions: [
          {
            id: "demo-action-measure-space",
            label: "Revisar mis medidas",
            intent: "sales.review-space",
            emphasis: "primary",
          },
        ],
        deliveryStatus: "sent",
        feedback: null,
      },
    ],
    demo: DEMO_METADATA,
  },
  {
    id: "demo-conversation-support-cooling",
    sessionId: "demo-session-support-001",
    agent: "support",
    title: "Nevera no está enfriando",
    startedAt: "2026-07-25T11:35:00-05:00",
    updatedAt: "2026-07-25T11:43:00-05:00",
    group: "today",
    context: {
      kind: "support",
      identifiedProductId: "demo-registered-refrigerator",
      symptoms: ["Enfría menos desde ayer"],
      warrantyId: "demo-warranty-active",
      diagnosticId: "demo-diagnostic-refrigerator-cooling",
      attachmentIds: [],
    },
    messages: [
      {
        id: "demo-message-support-001-user",
        agent: "support",
        author: "user",
        authorLabel: "Tú",
        createdAt: "2026-07-25T11:35:00-05:00",
        content: "Mi nevera está prendida, pero desde ayer enfría menos.",
        deliveryStatus: "sent",
      },
      {
        id: "demo-message-support-001-agent",
        agent: "support",
        author: "agent",
        authorLabel: "Experto técnico",
        createdAt: "2026-07-25T11:35:07-05:00",
        content:
          "Vamos a revisar algunas causas sencillas y seguras antes de solicitar una visita.",
        blocks: [
          {
            id: "demo-block-support-cooling-text",
            type: "text",
            text: "Empieza por revisar el cierre de la puerta. No retires cubiertas ni manipules componentes internos.",
          },
          {
            id: "demo-block-support-cooling-diagnostic",
            type: "diagnostic",
            diagnostic: MOCK_DIAGNOSTICS[0],
          },
        ],
        actions: [
          {
            id: "demo-action-stop-diagnostic",
            label: "Solicitar un técnico",
            intent: "support.request-technician",
            emphasis: "secondary",
          },
        ],
        deliveryStatus: "sent",
        feedback: null,
      },
    ],
    demo: DEMO_METADATA,
  },
  {
    id: "demo-conversation-sales-washer",
    sessionId: "demo-session-sales-002",
    agent: "sales",
    title: "Opciones de lavadora",
    startedAt: "2026-07-23T16:02:00-05:00",
    updatedAt: "2026-07-23T16:09:00-05:00",
    group: "this-week",
    context: {
      kind: "sales",
      category: "washer",
      householdSize: 3,
      budgetLabel: "Por definir",
      priorities: ["Capacidad", "Ciclos sencillos"],
      savedProductIds: [],
      comparisonProductIds: [
        "demo-washer-18",
        "demo-washer-12",
      ],
    },
    messages: [
      {
        id: "demo-message-sales-002-user",
        agent: "sales",
        author: "user",
        authorLabel: "Tú",
        createdAt: "2026-07-23T16:02:00-05:00",
        content: "Quiero comparar una lavadora de 12 kg con una de 18 kg.",
        deliveryStatus: "sent",
      },
      {
        id: "demo-message-sales-002-agent",
        agent: "sales",
        author: "agent",
        authorLabel: "Asesor de ventas",
        createdAt: "2026-07-23T16:02:06-05:00",
        content:
          "La diferencia principal es la capacidad. Para recomendarte bien, cuéntame cuántas personas viven en casa y cuántas cargas hacen por semana.",
        blocks: [
          {
            id: "demo-block-sales-washers",
            type: "product-list",
            title: "Lavadoras de demostración",
            products: [MOCK_PRODUCTS[2], MOCK_PRODUCTS[3]],
          },
        ],
        deliveryStatus: "sent",
        feedback: null,
      },
    ],
    demo: DEMO_METADATA,
  },
  {
    id: "demo-conversation-support-warranty",
    sessionId: "demo-session-support-002",
    agent: "support",
    title: "Consulta de garantía",
    startedAt: "2026-07-22T10:24:00-05:00",
    updatedAt: "2026-07-22T10:28:00-05:00",
    group: "this-week",
    context: {
      kind: "support",
      identifiedProductId: "demo-registered-washer",
      symptoms: [],
      warrantyId: "demo-warranty-verification",
      attachmentIds: [],
    },
    messages: [
      {
        id: "demo-message-support-002-user",
        agent: "support",
        author: "user",
        authorLabel: "Tú",
        createdAt: "2026-07-22T10:24:00-05:00",
        content: "Quiero saber si mi lavadora todavía tiene garantía.",
        deliveryStatus: "sent",
      },
      {
        id: "demo-message-support-002-agent",
        agent: "support",
        author: "agent",
        authorLabel: "Experto técnico",
        createdAt: "2026-07-22T10:24:06-05:00",
        content:
          "Todavía no puedo confirmar la cobertura porque esta demostración no está conectada al sistema oficial.",
        blocks: [
          {
            id: "demo-block-support-warranty",
            type: "warranty",
            warranty: MOCK_WARRANTIES[1],
          },
        ],
        actions: [
          {
            id: "demo-action-upload-invoice",
            label: "Adjuntar factura",
            intent: "support.upload-invoice",
            emphasis: "primary",
          },
        ],
        deliveryStatus: "sent",
        feedback: null,
      },
    ],
    demo: DEMO_METADATA,
  },
  {
    id: "demo-conversation-support-appointment",
    sessionId: "demo-session-support-003",
    agent: "support",
    title: "Visita técnica programada",
    startedAt: "2026-07-18T14:04:00-05:00",
    updatedAt: "2026-07-18T14:16:00-05:00",
    group: "previous",
    context: {
      kind: "support",
      identifiedProductId: "demo-registered-refrigerator",
      symptoms: ["Enfriamiento insuficiente"],
      diagnosticId: "demo-diagnostic-refrigerator-cooling",
      serviceRequestId: "demo-request-001",
      attachmentIds: [],
    },
    messages: [
      {
        id: "demo-message-support-003-user",
        agent: "support",
        author: "user",
        authorLabel: "Tú",
        createdAt: "2026-07-18T14:04:00-05:00",
        content: "Quiero agendar una visita para revisar la nevera.",
        deliveryStatus: "sent",
      },
      {
        id: "demo-message-support-003-agent",
        agent: "support",
        author: "agent",
        authorLabel: "Experto técnico",
        createdAt: "2026-07-18T14:16:00-05:00",
        content:
          "La franja quedó registrada para esta demostración. Confirma la disponibilidad real en el canal oficial antes de organizar tu tiempo.",
        blocks: [
          {
            id: "demo-block-support-appointment",
            type: "appointment",
            appointment: MOCK_APPOINTMENTS[0],
            request: MOCK_SERVICE_REQUESTS[0],
          },
        ],
        actions: [
          {
            id: "demo-action-calendar",
            label: "Agregar al calendario",
            intent: "support.add-to-calendar",
            emphasis: "primary",
          },
          {
            id: "demo-action-reschedule",
            label: "Consultar o reprogramar",
            intent: "support.reschedule",
            emphasis: "secondary",
          },
        ],
        deliveryStatus: "sent",
        feedback: null,
      },
    ],
    demo: DEMO_METADATA,
  },
] as const satisfies readonly Conversation[];

export const getMockConversationById = (
  conversationId: string,
): Conversation | undefined =>
  MOCK_CONVERSATIONS.find(
    (conversation) => conversation.id === conversationId,
  );

