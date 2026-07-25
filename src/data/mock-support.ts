import type {
  DiagnosticCase,
  IdentifiedProduct,
  SafetyAlert,
  ServiceAppointment,
  ServiceRequest,
  Warranty,
} from "../types/support";
import { DEMO_METADATA } from "./demo";

const DIAGNOSTIC_CHOICES = [
  { id: "worked", label: "Sí, funcionó" },
  { id: "continues", label: "El problema continúa" },
  { id: "cannot-check", label: "No puedo verificarlo" },
] as const;

/**
 * CASOS EXCLUSIVAMENTE DEMOSTRATIVOS.
 * No deben usarse para tomar decisiones técnicas, comerciales o de garantía.
 */
export const MOCK_IDENTIFIED_PRODUCTS = [
  {
    id: "demo-registered-refrigerator",
    category: "refrigerator",
    typeLabel: "Nevera",
    model: "REF-DEMO-420",
    serialMasked: "NV•••••482",
    approximatePurchaseDate: "2025-09-18",
    warrantyStatus: "active",
    manualAvailable: true,
    demo: DEMO_METADATA,
  },
  {
    id: "demo-registered-washer",
    category: "washer",
    typeLabel: "Lavadora",
    model: "LAV-DEMO-18",
    serialMasked: "LV•••••190",
    approximatePurchaseDate: "2023-04-10",
    warrantyStatus: "verification-required",
    manualAvailable: false,
    demo: DEMO_METADATA,
  },
] as const satisfies readonly IdentifiedProduct[];

export const MOCK_DIAGNOSTICS = [
  {
    id: "demo-diagnostic-refrigerator-cooling",
    productType: "Nevera",
    symptom: "No está enfriando como antes",
    status: "in-progress",
    progress: 50,
    steps: [
      {
        id: "cooling-door-check",
        order: 1,
        title: "Revisa el cierre de la puerta",
        instruction:
          "Confirma que ningún recipiente esté bloqueando la puerta y que cierre por completo.",
        status: "completed",
        choices: DIAGNOSTIC_CHOICES,
      },
      {
        id: "cooling-temperature-check",
        order: 2,
        title: "Verifica el ajuste de temperatura",
        instruction:
          "Mira el control exterior o accesible y confirma que no haya quedado en el nivel mínimo.",
        safetyNote:
          "No retires cubiertas ni manipules componentes internos.",
        status: "current",
        choices: DIAGNOSTIC_CHOICES,
      },
      {
        id: "cooling-ventilation-check",
        order: 3,
        title: "Deja espacio para ventilar",
        instruction:
          "Comprueba que las rejillas visibles no estén cubiertas por alimentos u objetos.",
        status: "pending",
        choices: DIAGNOSTIC_CHOICES,
      },
      {
        id: "cooling-professional-check",
        order: 4,
        title: "Solicita revisión técnica",
        instruction:
          "Si el problema continúa, suspende el diagnóstico y solicita una visita certificada.",
        safetyNote:
          "No intervengas refrigerantes, cableado ni componentes internos.",
        status: "pending",
        choices: DIAGNOSTIC_CHOICES,
      },
    ],
    demo: DEMO_METADATA,
  },
  {
    id: "demo-diagnostic-washer-start",
    productType: "Lavadora",
    symptom: "No inicia el ciclo",
    status: "inconclusive",
    progress: 66,
    steps: [
      {
        id: "washer-door-check",
        order: 1,
        title: "Confirma que la tapa esté cerrada",
        instruction:
          "Abre y vuelve a cerrar la tapa hasta que quede bien ajustada.",
        status: "completed",
        choices: DIAGNOSTIC_CHOICES,
      },
      {
        id: "washer-controls-check",
        order: 2,
        title: "Revisa el ciclo seleccionado",
        instruction:
          "Selecciona nuevamente el ciclo desde el panel exterior y presiona iniciar una sola vez.",
        status: "completed",
        choices: DIAGNOSTIC_CHOICES,
      },
      {
        id: "washer-service-check",
        order: 3,
        title: "Solicita acompañamiento",
        instruction:
          "Como el inconveniente continúa, un técnico certificado debe revisar el equipo.",
        safetyNote:
          "No abras el panel ni manipules conexiones eléctricas internas.",
        status: "current",
        choices: DIAGNOSTIC_CHOICES,
      },
    ],
    escalationReason:
      "Las verificaciones externas no permitieron resolver el inconveniente.",
    demo: DEMO_METADATA,
  },
  {
    id: "demo-diagnostic-stove-gas",
    productType: "Estufa",
    symptom: "Se percibe olor a gas",
    status: "technician-required",
    progress: 100,
    steps: [
      {
        id: "stove-stop-use",
        order: 1,
        title: "Suspende el uso",
        instruction:
          "No enciendas llamas, interruptores ni aparatos eléctricos cerca del equipo. Ventila el lugar si puedes hacerlo con seguridad y aléjate.",
        safetyNote:
          "Gestiona ayuda profesional desde un lugar seguro. No busques la fuga ni desarmes el equipo.",
        status: "current",
        choices: DIAGNOSTIC_CHOICES,
      },
    ],
    escalationReason:
      "Por seguridad, un olor a gas requiere atención profesional inmediata.",
    demo: DEMO_METADATA,
  },
] as const satisfies readonly DiagnosticCase[];

export const MOCK_WARRANTIES = [
  {
    id: "demo-warranty-active",
    productLabel: "Nevera demo 420 L",
    model: "REF-DEMO-420",
    serialMasked: "NV•••••482",
    status: "active",
    statusLabel: "Cobertura activa (demostración)",
    purchaseDate: "2025-09-18",
    coverageEndDate: "2027-09-18",
    coverageSummary:
      "Ejemplo de cobertura activa. Las condiciones reales deben consultarse en el sistema oficial.",
    nextAction: "Validar la factura y la referencia antes de solicitar servicio.",
    demo: DEMO_METADATA,
  },
  {
    id: "demo-warranty-verification",
    productLabel: "Lavadora demo 18 kg",
    model: "LAV-DEMO-18",
    serialMasked: "LV•••••190",
    status: "verification-required",
    statusLabel: "Requiere verificación",
    purchaseDate: "2023-04-10",
    coverageSummary:
      "No hay información oficial conectada. Necesitamos validar la factura o el número de serie completo en un canal seguro.",
    nextAction: "Adjuntar la factura o solicitar revisión con una persona.",
    demo: DEMO_METADATA,
  },
] as const satisfies readonly Warranty[];

export const MOCK_SAFETY_ALERTS = [
  {
    id: "demo-alert-gas",
    severity: "critical",
    title: "Suspende el uso del equipo",
    message:
      "Si percibes olor a gas, no enciendas llamas ni interruptores. Ventila solo si es seguro, aléjate y solicita ayuda profesional.",
    actionLabel: "Solicitar ayuda técnica",
    requiresProfessionalHelp: true,
  },
  {
    id: "demo-alert-electric",
    severity: "critical",
    title: "No vuelvas a encender el producto",
    message:
      "Si hay humo, chispas o recalentamiento, suspende el uso y solicita una revisión certificada.",
    actionLabel: "Hablar con soporte",
    requiresProfessionalHelp: true,
  },
] as const satisfies readonly SafetyAlert[];

export const MOCK_SERVICE_REQUESTS = [
  {
    id: "demo-request-001",
    provisionalNumber: "SOL-DEMO-2401",
    productLabel: "Nevera demo 420 L",
    model: "REF-DEMO-420",
    serviceType: "Diagnóstico en domicilio",
    city: "Medellín",
    addressMasked: "Cra. 4•• # 1•-••",
    status: "scheduled",
    statusLabel: "Visita programada (demostración)",
    contactName: "Camila",
    contactPhoneMasked: "3•• ••• 0198",
    createdAt: "2026-07-25T14:10:00-05:00",
    timeline: [
      {
        id: "request-created",
        label: "Solicitud recibida",
        occurredAt: "2026-07-25T14:10:00-05:00",
        completed: true,
      },
      {
        id: "request-scheduled",
        label: "Franja reservada",
        occurredAt: "2026-07-25T14:14:00-05:00",
        completed: true,
      },
      {
        id: "request-visit",
        label: "Visita técnica",
        occurredAt: "2026-07-29T08:00:00-05:00",
        completed: false,
      },
    ],
    demo: DEMO_METADATA,
  },
  {
    id: "demo-request-002",
    provisionalNumber: "SOL-DEMO-2386",
    productLabel: "Lavadora demo 18 kg",
    model: "LAV-DEMO-18",
    serviceType: "Revisión de funcionamiento",
    city: "Bogotá",
    addressMasked: "Cl. 8• # 2•-••",
    status: "submitted",
    statusLabel: "Solicitud recibida (demostración)",
    contactName: "Andrés",
    contactPhoneMasked: "3•• ••• 7712",
    createdAt: "2026-07-22T09:35:00-05:00",
    timeline: [
      {
        id: "request-created",
        label: "Solicitud recibida",
        occurredAt: "2026-07-22T09:35:00-05:00",
        completed: true,
      },
      {
        id: "request-validation",
        label: "Validación de datos",
        occurredAt: "2026-07-22T09:35:00-05:00",
        completed: false,
      },
    ],
    demo: DEMO_METADATA,
  },
] as const satisfies readonly ServiceRequest[];

export const MOCK_APPOINTMENTS = [
  {
    id: "demo-appointment-001",
    requestId: "demo-request-001",
    provisionalNumber: "SOL-DEMO-2401",
    serviceType: "Diagnóstico en domicilio",
    productLabel: "Nevera demo 420 L",
    model: "REF-DEMO-420",
    city: "Medellín",
    addressMasked: "Cra. 4•• # 1•-••",
    date: "2026-07-29",
    timeSlot: "8:00 a. m. – 12:00 m.",
    contactName: "Camila",
    contactPhoneMasked: "3•• ••• 0198",
    availability: "confirmed",
    statusLabel: "Cita confirmada (demostración)",
    calendarTitle: "Visita técnica — referencia provisional",
    demo: DEMO_METADATA,
  },
] as const satisfies readonly ServiceAppointment[];

export const getMockDiagnosticById = (
  diagnosticId: string,
): DiagnosticCase | undefined =>
  MOCK_DIAGNOSTICS.find((diagnostic) => diagnostic.id === diagnosticId);

export const getMockWarrantyById = (
  warrantyId: string,
): Warranty | undefined =>
  MOCK_WARRANTIES.find((warranty) => warranty.id === warrantyId);

export const getMockServiceRequestById = (
  requestId: string,
): ServiceRequest | undefined =>
  MOCK_SERVICE_REQUESTS.find((request) => request.id === requestId);

