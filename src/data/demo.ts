import type { DemonstrationMetadata } from "../types/agent";

export const DEMO_METADATA = {
  isDemonstration: true,
  notice:
    "Dato demostrativo. Debe reemplazarse y validarse con fuentes oficiales de HACEB antes de publicar.",
} as const satisfies DemonstrationMetadata;

export const DEMO_DATA_NOTICE =
  "Información demostrativa: precios, inventario, referencias, garantías y citas deben confirmarse con los sistemas oficiales.";

