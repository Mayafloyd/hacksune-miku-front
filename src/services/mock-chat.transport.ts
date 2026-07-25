import {
  MOCK_PRODUCT_COMPARISON,
  MOCK_PRODUCTS,
} from "../data/mock-products";
import {
  MOCK_APPOINTMENTS,
  MOCK_DIAGNOSTICS,
  MOCK_SAFETY_ALERTS,
  MOCK_SERVICE_REQUESTS,
  MOCK_WARRANTIES,
} from "../data/mock-support";
import type {
  AgentResponse,
  AgentResponseBlock,
  AgentStreamEvent,
  ChatRequest,
  FormBlock,
  HumanHandoffBlock,
  TextBlock,
} from "../types/chat";
import type { ProductCategory } from "../types/product";
import {
  CHAT_API_ENDPOINT,
  type ChatTransport,
  type ChatTransportOptions,
} from "./chat.transport";

export interface MockChatTransportOptions {
  readonly initialDelayMs?: number;
  readonly chunkDelayMs?: number;
  readonly chunkSize?: number;
}

export const MOCK_SCENARIO_PROMPTS = {
  offline: "[demo:offline]",
  agentError: "[demo:agent-error]",
  sessionExpired: "[demo:session-expired]",
} as const;

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO");

const includesAny = (
  value: string,
  keywords: readonly string[],
): boolean => keywords.some((keyword) => value.includes(keyword));

const createAbortError = (): Error => {
  const error = new Error("La operación fue cancelada.");
  error.name = "AbortError";
  return error;
};

const wait = (
  durationMs: number,
  signal?: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, durationMs);

    const handleAbort = (): void => {
      clearTimeout(timeoutId);
      reject(createAbortError());
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
  });

const splitIntoChunks = (
  value: string,
  chunkSize: number,
): readonly string[] => {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }
  return chunks;
};

const categoryFromMessage = (
  normalizedMessage: string,
): ProductCategory | undefined => {
  if (normalizedMessage.includes("nevera")) return "refrigerator";
  if (normalizedMessage.includes("lavadora")) return "washer";
  if (normalizedMessage.includes("estufa")) return "stove";
  if (normalizedMessage.includes("calentador")) return "water-heater";
  if (
    normalizedMessage.includes("aire") ||
    normalizedMessage.includes("acondicionado")
  ) {
    return "air-conditioner";
  }
  return undefined;
};

const textBlock = (id: string, text: string): TextBlock => ({
  id,
  type: "text",
  text,
});

const humanHandoffBlock = (
  responseId: string,
  agent: ChatRequest["agent"],
  options: {
    readonly title?: string;
    readonly message?: string;
    readonly actionLabel?: string;
  } = {},
): HumanHandoffBlock => ({
  id: `${responseId}-handoff`,
  type: "human-handoff",
  title: options.title ?? "Acompañamiento de una persona",
  message:
    options.message ??
    (agent === "sales"
      ? "Una persona del equipo comercial puede continuar la orientación y validar la información vigente."
      : "Una persona del equipo de soporte puede revisar el caso y orientarte por un canal seguro."),
  status: "offered",
  actionLabel:
    options.actionLabel ??
    (agent === "sales"
      ? "Solicitar asesor comercial"
      : "Solicitar acompañamiento"),
});

const isHumanHandoffIntent = (normalizedMessage: string): boolean =>
  normalizedMessage.includes("humano") ||
  includesAny(normalizedMessage, [
    "atencion humana",
    "hablar con alguien",
    "hablar con una persona",
    "hablar con un asesor",
    "hablar con soporte",
    "hablar con ventas",
    "asesor comercial",
    "servicio al cliente",
  ]);

interface SpaceDimensions {
  readonly widthCm: number | undefined;
  readonly heightCm: number | undefined;
  readonly depthCm: number | undefined;
}

const parseMeasurement = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;

  const measurement = Number(value.replace(",", "."));
  return Number.isFinite(measurement) && measurement > 0
    ? measurement
    : undefined;
};

const measurementForLabels = (
  normalizedMessage: string,
  labels: readonly string[],
): number | undefined => {
  const labelPattern = labels.join("|");
  const afterLabel = normalizedMessage.match(
    new RegExp(
      `(?:${labelPattern})\\s*(?:disponible|de)?\\s*(?:de|:|es|son|=)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:cm|centimetros?)`,
    ),
  );
  const beforeLabel = normalizedMessage.match(
    new RegExp(
      `(\\d+(?:[.,]\\d+)?)\\s*(?:cm|centimetros?)\\s*(?:de\\s*)?(?:${labelPattern})`,
    ),
  );

  return parseMeasurement(afterLabel?.[1] ?? beforeLabel?.[1]);
};

const dimensionsFromMessage = (
  normalizedMessage: string,
): SpaceDimensions => {
  const labeledDimensions: SpaceDimensions = {
    widthCm: measurementForLabels(normalizedMessage, ["ancho", "anchura"]),
    heightCm: measurementForLabels(normalizedMessage, ["alto", "altura"]),
    depthCm: measurementForLabels(normalizedMessage, [
      "fondo",
      "profundidad",
    ]),
  };

  if (
    labeledDimensions.widthCm !== undefined ||
    labeledDimensions.heightCm !== undefined ||
    labeledDimensions.depthCm !== undefined
  ) {
    return labeledDimensions;
  }

  const orderedMeasurements = Array.from(
    normalizedMessage.matchAll(
      /(\d+(?:[.,]\d+)?)\s*(?:cm|centimetros?)/g,
    ),
    (match) => parseMeasurement(match[1]),
  ).filter((measurement): measurement is number => measurement !== undefined);

  return {
    widthCm: orderedMeasurements[0],
    heightCm: orderedMeasurements[1],
    depthCm: orderedMeasurements[2],
  };
};

const hasDimensions = (dimensions: SpaceDimensions): boolean =>
  dimensions.widthCm !== undefined ||
  dimensions.heightCm !== undefined ||
  dimensions.depthCm !== undefined;

const buildSpaceExplorationBlocks = (
  normalizedMessage: string,
  responseId: string,
  contextCategory?: ProductCategory,
): readonly AgentResponseBlock[] => {
  const category =
    categoryFromMessage(normalizedMessage) ??
    contextCategory;
  const dimensions = dimensionsFromMessage(normalizedMessage);

  if (!category || !hasDimensions(dimensions)) {
    return [
      textBlock(
        `${responseId}-text`,
        "Para explorar por espacio, dime el tipo de electrodoméstico y las medidas máximas disponibles en centímetros: ancho, alto y fondo. No olvides que la ventilación y la instalación deben validarse después con la ficha oficial.",
      ),
    ];
  }

  const products = MOCK_PRODUCTS.filter(
    (product) =>
      product.category === category &&
      (dimensions.widthCm === undefined ||
        product.dimensions.widthCm <= dimensions.widthCm) &&
      (dimensions.heightCm === undefined ||
        product.dimensions.heightCm <= dimensions.heightCm) &&
      (dimensions.depthCm === undefined ||
        product.dimensions.depthCm <= dimensions.depthCm),
  ).slice(0, 3);

  if (products.length === 0) {
    return [
      textBlock(
        `${responseId}-text`,
        "No encontré una coincidencia dimensional en el catálogo demostrativo. No conviene forzar la instalación: podemos revisar otra categoría o confirmar nuevamente ancho, alto y fondo.",
      ),
      {
        id: `${responseId}-products`,
        type: "product-list",
        title: "Sin coincidencias dimensionales",
        products: [],
        emptyMessage:
          "Estas medidas no coinciden con las referencias demostrativas. Valida también las holguras de instalación en la ficha oficial.",
      },
    ];
  }

  return [
    textBlock(
      `${responseId}-text`,
      "Encontré opciones cuyas dimensiones demostrativas no superan las medidas que indicaste. Es una preselección: confirma las holguras de ventilación e instalación, además del precio y la disponibilidad, en las fuentes oficiales.",
    ),
    {
      id: `${responseId}-products`,
      type: "product-list",
      title: "Opciones que caben por medidas",
      products,
    },
  ];
};

const buildCreditBlocks = (
  responseId: string,
): readonly AgentResponseBlock[] => [
  textBlock(
    `${responseId}-text`,
    "Puedo orientarte, pero esta demostración no consulta planes de crédito vigentes ni puede confirmar tasas, cupos, cuotas o aprobación. Antes de aceptar una opción, valida el costo total, el plazo y todas las condiciones en el canal oficial. No compartas contraseñas, códigos ni datos financieros en el chat.",
  ),
  humanHandoffBlock(responseId, "sales", {
    title: "Validar opciones de crédito",
    message:
      "Una persona del equipo comercial puede explicarte las alternativas vigentes y el proceso de validación.",
    actionLabel: "Hablar con asesor de crédito",
  }),
];

const buildHumanHandoffBlocks = (
  agent: ChatRequest["agent"],
  responseId: string,
): readonly AgentResponseBlock[] => [
  textBlock(
    `${responseId}-text`,
    agent === "sales"
      ? "Claro. Puedo dejar preparado el traspaso al equipo comercial. Evita compartir contraseñas, códigos de verificación o datos financieros en esta conversación."
      : "Claro. Puedo dejar preparado el traspaso al equipo de soporte. Si existe olor a gas, humo, chispas o recalentamiento, suspende el uso y aléjate antes de continuar.",
  ),
  humanHandoffBlock(responseId, agent),
];

const buildSalesBlocks = (
  request: ChatRequest,
  responseId: string,
): readonly AgentResponseBlock[] => {
  const message = request.message;
  const normalizedMessage = normalize(message);

  if (normalizedMessage.includes("recomiend")) {
    return [
      textBlock(
        `${responseId}-text`,
        "Con la información disponible, esta sería una recomendación inicial de demostración. Para afinarla todavía necesito validar espacio, capacidad y prioridades contigo.",
      ),
      {
        id: `${responseId}-products`,
        type: "product-list",
        title: "Recomendación inicial",
        products: MOCK_PRODUCTS.slice(0, 2),
      },
    ];
  }

  if (
    normalizedMessage.includes("sin resultados") ||
    normalizedMessage.includes("no existe")
  ) {
    return [
      textBlock(
        `${responseId}-text`,
        "No encontré una coincidencia exacta. Podemos ajustar algunas características para ampliar las opciones.",
      ),
      {
        id: `${responseId}-products`,
        type: "product-list",
        title: "Sin coincidencias",
        products: [],
        emptyMessage:
          "No encontré una coincidencia exacta. Probemos con otra capacidad o categoría.",
      },
    ];
  }

  if (
    includesAny(normalizedMessage, [
      "credito",
      "financiacion",
      "financiamiento",
      "pagar a cuotas",
      "opciones de cuotas",
    ])
  ) {
    return buildCreditBlocks(responseId);
  }

  if (
    includesAny(normalizedMessage, [
      "explorar por espacio",
      "buscar por espacio",
      "espacio disponible",
      "medidas disponibles",
      "dimensiones disponibles",
      "cabe en",
      "ancho disponible",
      "alto disponible",
      "fondo disponible",
    ])
  ) {
    return buildSpaceExplorationBlocks(
      normalizedMessage,
      responseId,
      request.productContext.category,
    );
  }

  if (isHumanHandoffIntent(normalizedMessage)) {
    return buildHumanHandoffBlocks("sales", responseId);
  }

  if (normalizedMessage.includes("compar")) {
    return [
      textBlock(
        `${responseId}-text`,
        "Preparé una comparación demostrativa. La diferencia principal está en la capacidad y el espacio que ocupa cada opción.",
      ),
      {
        id: `${responseId}-comparison`,
        type: "product-comparison",
        title: "Comparación de neveras",
        products: [MOCK_PRODUCTS[0], MOCK_PRODUCTS[1]],
        comparison: MOCK_PRODUCT_COMPARISON,
      },
    ];
  }

  const category =
    categoryFromMessage(normalizedMessage) ??
    request.productContext.category;
  const products = category
    ? MOCK_PRODUCTS.filter((product) => product.category === category).slice(
        0,
        3,
      )
    : MOCK_PRODUCTS.slice(0, 3);
  const categoryCopy = category
    ? normalizedMessage.includes("persona")
      ? "Perfecto. Ahora dime cuánto espacio tienes disponible: ancho, alto y fondo aproximados."
      : /\d+\s*(?:cm|centimetros?)/.test(normalizedMessage)
        ? "Las medidas ayudan mucho. ¿Prefieres priorizar capacidad, ahorro de energía o diseño?"
        : normalizedMessage.includes("presupuesto")
          ? "Entendido. Para cerrar la recomendación, dime qué característica es indispensable para ti."
          : "Encontré estas opciones demostrativas para empezar. ¿Para cuántas personas sería?"
    : "Te ayudaré a encontrar una opción que se ajuste a tu espacio y a lo que necesitas. Para empezar, ¿qué tipo de electrodoméstico buscas?";

  return [
    textBlock(`${responseId}-text`, categoryCopy),
    ...(category
      ? [
          {
            id: `${responseId}-products`,
            type: "product-list" as const,
            title: "Opciones para revisar",
            products,
          },
        ]
      : []),
  ];
};

const scheduleForm = (responseId: string): FormBlock => ({
  id: `${responseId}-schedule-form`,
  type: "form",
  title: "Datos para solicitar la visita",
  description:
    "Completa la información y revisa el resumen antes de enviar. La disponibilidad mostrada será demostrativa.",
  fields: [
    {
      id: "service-type",
      name: "serviceType",
      label: "Tipo de servicio",
      type: "select",
      required: true,
      options: [
        { value: "diagnostic", label: "Diagnóstico en domicilio" },
        { value: "maintenance", label: "Mantenimiento" },
      ],
    },
    {
      id: "product-model",
      name: "model",
      label: "Referencia o modelo",
      type: "text",
      placeholder: "Ej. REF-0000",
      required: true,
    },
    {
      id: "city",
      name: "city",
      label: "Ciudad",
      type: "text",
      placeholder: "Ej. Medellín",
      required: true,
    },
    {
      id: "address",
      name: "address",
      label: "Dirección",
      type: "text",
      required: true,
    },
    {
      id: "preferred-date",
      name: "date",
      label: "Fecha preferida",
      type: "date",
      required: true,
    },
    {
      id: "time-slot",
      name: "timeSlot",
      label: "Franja horaria",
      type: "time-slot",
      required: true,
      options: [
        { value: "morning", label: "8:00 a. m. – 12:00 m." },
        { value: "afternoon", label: "1:00 p. m. – 5:00 p. m." },
      ],
    },
    {
      id: "phone",
      name: "phone",
      label: "Celular de contacto",
      type: "tel",
      required: true,
    },
  ],
  submitLabel: "Revisar solicitud",
});

const buildCriticalSupportBlocks = (
  normalizedMessage: string,
  responseId: string,
): readonly AgentResponseBlock[] => {
  const alert =
    normalizedMessage.includes("humo") ||
    normalizedMessage.includes("chispa") ||
    normalizedMessage.includes("recalent")
      ? MOCK_SAFETY_ALERTS[1]
      : MOCK_SAFETY_ALERTS[0];
  const handoff = humanHandoffBlock(responseId, "support", {
    title: "Revisión profesional necesaria",
    message:
      "Por seguridad, este caso debe ser revisado por un técnico certificado.",
    actionLabel: "Solicitar ayuda técnica",
  });

  return [
    textBlock(
      `${responseId}-text`,
      "Suspendamos el diagnóstico. Lo más importante ahora es mantenerte lejos del riesgo y gestionar ayuda profesional.",
    ),
    {
      id: `${responseId}-safety`,
      type: "safety-alert",
      alert,
    },
    handoff,
  ];
};

const findReferencedServiceRequest = (
  request: ChatRequest,
  normalizedMessage: string,
) => {
  const contextRequestId = request.productContext["serviceRequestId"];

  return MOCK_SERVICE_REQUESTS.find(
    (serviceRequest) =>
      (typeof contextRequestId === "string" &&
        contextRequestId === serviceRequest.id) ||
      normalizedMessage.includes(
        normalize(serviceRequest.provisionalNumber),
      ),
  );
};

const buildServiceRequestStatusBlocks = (
  request: ChatRequest,
  normalizedMessage: string,
  responseId: string,
): readonly AgentResponseBlock[] => {
  const serviceRequest =
    findReferencedServiceRequest(request, normalizedMessage) ??
    (normalizedMessage.includes("reprogram")
      ? MOCK_SERVICE_REQUESTS[0]
      : undefined);

  if (!serviceRequest) {
    return [
      textBlock(
        `${responseId}-text`,
        "Para consultar el estado necesito el número provisional de la solicitud. Compártelo con el formato SOL-…; no incluyas aquí tu dirección, teléfono ni otros datos personales. La demostración solo puede reconocer solicitudes simuladas.",
      ),
    ];
  }

  const appointment = MOCK_APPOINTMENTS.find(
    (candidate) => candidate.requestId === serviceRequest.id,
  );

  return [
    textBlock(
      `${responseId}-text`,
      `La solicitud ${serviceRequest.provisionalNumber} figura como “${serviceRequest.statusLabel}”. Es un estado demostrativo y debe confirmarse en el sistema oficial antes de tomar decisiones.`,
    ),
    ...(appointment
      ? [
          {
            id: `${responseId}-appointment`,
            type: "appointment" as const,
            appointment,
            request: serviceRequest,
          },
        ]
      : []),
  ];
};

const findReferencedProduct = (normalizedMessage: string) =>
  MOCK_PRODUCTS.find((product) =>
    normalizedMessage.includes(normalize(product.model)),
  );

const buildSparePartBlocks = (
  normalizedMessage: string,
  responseId: string,
): readonly AgentResponseBlock[] => {
  const product = findReferencedProduct(normalizedMessage);
  const identificationCopy = product
    ? `Tomé como referencia demostrativa ${product.model}.`
    : "Necesito el tipo de producto y la referencia o modelo exactos de la placa.";

  return [
    textBlock(
      `${responseId}-text`,
      `${identificationCopy} Cuéntame qué pieza necesitas o qué función cumple; una foto exterior también puede ayudar. No retires cubiertas ni desarmes el equipo para identificarla. La compatibilidad, el precio y la disponibilidad del repuesto deben confirmarse en el catálogo oficial.`,
    ),
    humanHandoffBlock(responseId, "support", {
      title: "Validación de compatibilidad",
      message:
        "Una persona de soporte puede validar la referencia antes de que solicites o instales un repuesto.",
      actionLabel: "Validar repuesto con soporte",
    }),
  ];
};

const buildMaintenanceBlocks = (
  responseId: string,
): readonly AgentResponseBlock[] => [
  textBlock(
    `${responseId}-text`,
    "Te ayudo a solicitar mantenimiento. Antes de agendar, identifica el producto y su referencia. No abras el equipo ni manipules gas, refrigerantes o conexiones eléctricas internas; el alcance y la disponibilidad de la visita deben confirmarse por el canal oficial.",
  ),
  scheduleForm(responseId),
];

const buildProductRegistrationBlocks = (
  request: ChatRequest,
  responseId: string,
): readonly AgentResponseBlock[] => {
  const attachmentCopy =
    request.attachments.length > 0
      ? "Veo un archivo adjunto, pero esta demostración no valida ni registra su contenido."
      : "Puedes adjuntar una foto legible de la placa sin personas, direcciones ni documentos visibles.";

  return [
    textBlock(
      `${responseId}-text`,
      `Para iniciar el registro necesito el tipo de producto, la referencia o modelo y la fecha aproximada de compra. ${attachmentCopy} El número de serie y la factura deben validarse en un canal oficial seguro; aquí no se creará un registro real.`,
    ),
    humanHandoffBlock(responseId, "support", {
      title: "Registro con validación",
      message:
        "Una persona de soporte puede ayudarte a validar la información y completar el registro en el canal correspondiente.",
      actionLabel: "Solicitar ayuda para registrar",
    }),
  ];
};

const buildSupportBlocks = (
  request: ChatRequest,
  responseId: string,
): readonly AgentResponseBlock[] => {
  const normalizedMessage = normalize(request.message);

  if (
    ["gas", "humo", "chispa", "recalent"].some((keyword) =>
      normalizedMessage.includes(keyword),
    )
  ) {
    return buildCriticalSupportBlocks(normalizedMessage, responseId);
  }

  if (isHumanHandoffIntent(normalizedMessage)) {
    return buildHumanHandoffBlocks("support", responseId);
  }

  if (
    normalizedMessage.includes("cita confirmada") ||
    normalizedMessage.includes("confirmar cita")
  ) {
    return [
      textBlock(
        `${responseId}-text`,
        "La cita quedó registrada en esta demostración. Confirma la disponibilidad en el sistema oficial antes de organizar tu tiempo.",
      ),
      {
        id: `${responseId}-appointment`,
        type: "appointment",
        appointment: MOCK_APPOINTMENTS[0],
        request: MOCK_SERVICE_REQUESTS[0],
      },
    ];
  }

  if (
    includesAny(normalizedMessage, [
      "consultar una solicitud",
      "consultar mi solicitud",
      "estado de solicitud",
      "estado de una solicitud",
      "estado de la solicitud",
      "estado de mi solicitud",
      "seguimiento de la solicitud",
      "consultar o reprogramar",
      "reprogramar mi visita",
      "sol-demo-",
    ]) ||
    (normalizedMessage.includes("estado") &&
      normalizedMessage.includes("solicitud"))
  ) {
    return buildServiceRequestStatusBlocks(
      request,
      normalizedMessage,
      responseId,
    );
  }

  if (
    includesAny(normalizedMessage, [
      "repuesto",
      "refaccion",
      "pieza de recambio",
    ])
  ) {
    return buildSparePartBlocks(normalizedMessage, responseId);
  }

  if (
    includesAny(normalizedMessage, [
      "registrar mi producto",
      "registrar producto",
      "registro de producto",
      "vincular mi producto",
    ])
  ) {
    return buildProductRegistrationBlocks(request, responseId);
  }

  if (
    includesAny(normalizedMessage, [
      "mantenimiento",
      "mantencion",
      "revision preventiva",
    ])
  ) {
    return buildMaintenanceBlocks(responseId);
  }

  if (
    normalizedMessage.includes("agendar") ||
    normalizedMessage.includes("visita")
  ) {
    return [
      textBlock(
        `${responseId}-text`,
        "Te acompaño con la solicitud. Primero necesitamos los datos del producto, la ubicación y una fecha preferida.",
      ),
      scheduleForm(responseId),
    ];
  }

  if (normalizedMessage.includes("garantia")) {
    return [
      textBlock(
        `${responseId}-text`,
        "Encontré un estado de ejemplo. Para confirmar la cobertura real debemos validar la referencia y la factura en el sistema oficial.",
      ),
      {
        id: `${responseId}-warranty`,
        type: "warranty",
        warranty: MOCK_WARRANTIES[0],
      },
    ];
  }

  if (
    normalizedMessage.includes("lavadora") &&
    (normalizedMessage.includes("inicia") ||
      normalizedMessage.includes("prende"))
  ) {
    return [
      textBlock(
        `${responseId}-text`,
        "Vamos a revisar algunas causas sencillas y seguras antes de solicitar una visita.",
      ),
      {
        id: `${responseId}-diagnostic`,
        type: "diagnostic",
        diagnostic: MOCK_DIAGNOSTICS[1],
      },
    ];
  }

  if (
    normalizedMessage.includes("nevera") ||
    normalizedMessage.includes("enfria")
  ) {
    return [
      textBlock(
        `${responseId}-text`,
        "Vamos a revisar algunas causas sencillas y seguras antes de solicitar una visita.",
      ),
      {
        id: `${responseId}-diagnostic`,
        type: "diagnostic",
        diagnostic: MOCK_DIAGNOSTICS[0],
      },
    ];
  }

  return [
    textBlock(
      `${responseId}-text`,
      "Cuéntame qué producto tienes, su referencia si la conoces y qué está sucediendo. No necesitas abrir ni desarmar el equipo.",
    ),
  ];
};

export const buildMockAgentBlocks = (
  request: ChatRequest,
  responseId: string,
): readonly AgentResponseBlock[] =>
  request.agent === "sales"
    ? buildSalesBlocks(request, responseId)
    : buildSupportBlocks(request, responseId);

let responseSequence = 0;

const nextResponseId = (): string => {
  responseSequence += 1;
  return `demo-response-${Date.now()}-${responseSequence}`;
};

const getScenarioError = (
  request: ChatRequest,
): Extract<AgentStreamEvent, { type: "error" }> | undefined => {
  const normalizedMessage = normalize(request.message);

  if (normalizedMessage.includes(MOCK_SCENARIO_PROMPTS.offline)) {
    return {
      type: "error",
      code: "offline",
      message:
        "No tienes conexión en este momento. Tu conversación sigue guardada.",
      retryable: true,
    };
  }
  if (normalizedMessage.includes(MOCK_SCENARIO_PROMPTS.agentError)) {
    return {
      type: "error",
      code: "agent-error",
      message:
        "No pudimos completar la consulta. Tu conversación sigue guardada y puedes intentarlo nuevamente.",
      retryable: true,
    };
  }
  if (normalizedMessage.includes(MOCK_SCENARIO_PROMPTS.sessionExpired)) {
    return {
      type: "error",
      code: "session-expired",
      message:
        "Tu sesión venció. Inicia sesión nuevamente para continuar con esta conversación.",
      retryable: false,
    };
  }
  return undefined;
};

export class MockChatTransport implements ChatTransport {
  readonly kind = "mock" as const;
  readonly endpoint = CHAT_API_ENDPOINT;

  private readonly initialDelayMs: number;
  private readonly chunkDelayMs: number;
  private readonly chunkSize: number;

  constructor(options: MockChatTransportOptions = {}) {
    this.initialDelayMs = options.initialDelayMs ?? 180;
    this.chunkDelayMs = options.chunkDelayMs ?? 24;
    this.chunkSize = Math.max(1, options.chunkSize ?? 18);
  }

  async *stream(
    request: ChatRequest,
    options: ChatTransportOptions = {},
  ): AsyncIterable<AgentStreamEvent> {
    const responseId = nextResponseId();
    const scenarioError = getScenarioError(request);

    try {
      await wait(this.initialDelayMs, options.signal);
      if (scenarioError) {
        yield { ...scenarioError, responseId };
        return;
      }

      const blocks = buildMockAgentBlocks(request, responseId);
      const response: AgentResponse = {
        id: responseId,
        agent: request.agent,
        sessionId: request.sessionId,
        blocks,
        createdAt: new Date().toISOString(),
      };

      yield {
        type: "start",
        responseId,
        agent: request.agent,
        status: request.agent === "sales" ? "consulting" : "thinking",
      };

      const firstBlock = blocks[0];
      if (firstBlock?.type === "text") {
        for (const delta of splitIntoChunks(
          firstBlock.text,
          this.chunkSize,
        )) {
          await wait(this.chunkDelayMs, options.signal);
          yield {
            type: "text-delta",
            responseId,
            delta,
          };
        }
      }

      for (const block of blocks.slice(1)) {
        await wait(this.chunkDelayMs, options.signal);
        yield {
          type: "block",
          responseId,
          block,
        };
      }

      yield {
        type: "done",
        response,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      yield {
        type: "error",
        responseId,
        code: "agent-error",
        message:
          "No pudimos completar la consulta. Tu conversación sigue guardada y puedes intentarlo nuevamente.",
        retryable: true,
      };
    }
  }
}
