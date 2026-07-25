import type {
  Product,
  ProductComparison,
  ProductCategory,
} from "../types/product";
import { DEMO_METADATA } from "./demo";

/**
 * CATÁLOGO EXCLUSIVAMENTE DEMOSTRATIVO.
 *
 * Las referencias, especificaciones, valoraciones y estados no representan el
 * portafolio comercial vigente. Sustituir este arreglo por la API oficial.
 */
export const MOCK_PRODUCTS = [
  {
    id: "demo-refrigerator-420",
    slug: "nevera-demo-420-litros",
    name: "Nevera demo 420 L",
    model: "REF-DEMO-420",
    category: "refrigerator",
    categoryLabel: "Neveras",
    summary:
      "Ejemplo de nevera amplia para visualizar recomendaciones familiares.",
    image: {
      src: "/images/product-placeholder.svg",
      alt: "Marcador de posición para una nevera de demostración",
      isPlaceholder: true,
    },
    price: {
      status: "on-request",
      label: "Consultar precio",
    },
    availability: {
      status: "unknown",
      label: "Disponibilidad por confirmar",
    },
    features: [
      "Distribución interior flexible (demostración)",
      "Control digital de temperatura (demostración)",
      "Zona de conservación independiente (demostración)",
    ],
    technologies: ["Tecnología de enfriamiento por confirmar"],
    capacity: {
      value: 420,
      unit: "L",
      label: "420 L (dato demostrativo)",
    },
    dimensions: {
      widthCm: 70,
      heightCm: 180,
      depthCm: 73,
    },
    energyRating: "Clasificación por confirmar",
    colors: [
      { name: "Acero", hex: "#A8AAAD" },
      { name: "Grafito", hex: "#3B3D3F" },
    ],
    rating: {
      score: 4.7,
      scale: 5,
      reviewCount: 128,
      source: "demonstration",
    },
    warrantyLabel: "Cobertura por confirmar con la referencia oficial",
    demo: DEMO_METADATA,
  },
  {
    id: "demo-refrigerator-300",
    slug: "nevera-demo-300-litros",
    name: "Nevera demo 300 L",
    model: "REF-DEMO-300",
    category: "refrigerator",
    categoryLabel: "Neveras",
    summary:
      "Ejemplo compacto pensado para hogares con espacio moderado.",
    image: {
      src: "/images/product-placeholder.svg",
      alt: "Marcador de posición para una nevera compacta de demostración",
      isPlaceholder: true,
    },
    price: {
      status: "unknown",
      label: "Precio por confirmar",
    },
    availability: {
      status: "unknown",
      label: "Disponibilidad por confirmar",
    },
    features: [
      "Bandejas ajustables (demostración)",
      "Congelador superior (demostración)",
      "Iluminación interior (demostración)",
    ],
    technologies: ["Sistema de conservación por confirmar"],
    capacity: {
      value: 300,
      unit: "L",
      label: "300 L (dato demostrativo)",
    },
    dimensions: {
      widthCm: 61,
      heightCm: 168,
      depthCm: 67,
    },
    energyRating: "Clasificación por confirmar",
    colors: [{ name: "Blanco", hex: "#F4F4F1" }],
    warrantyLabel: "Cobertura por confirmar con la referencia oficial",
    demo: DEMO_METADATA,
  },
  {
    id: "demo-washer-18",
    slug: "lavadora-demo-18-kilos",
    name: "Lavadora demo 18 kg",
    model: "LAV-DEMO-18",
    category: "washer",
    categoryLabel: "Lavadoras",
    summary:
      "Ejemplo de alta capacidad para comparar ciclos y necesidades familiares.",
    image: {
      src: "/images/product-placeholder.svg",
      alt: "Marcador de posición para una lavadora de demostración",
      isPlaceholder: true,
    },
    price: {
      status: "on-request",
      label: "Consultar precio",
    },
    availability: {
      status: "unknown",
      label: "Disponibilidad por confirmar",
    },
    features: [
      "Carga superior (demostración)",
      "Ciclos configurables (demostración)",
      "Bloqueo de seguridad (demostración)",
    ],
    technologies: ["Lavado inteligente por confirmar"],
    capacity: {
      value: 18,
      unit: "kg",
      label: "18 kg (dato demostrativo)",
    },
    dimensions: {
      widthCm: 66,
      heightCm: 104,
      depthCm: 68,
    },
    energyRating: "Consumo por confirmar",
    colors: [{ name: "Gris", hex: "#9A9C9E" }],
    rating: {
      score: 4.5,
      scale: 5,
      reviewCount: 86,
      source: "demonstration",
    },
    warrantyLabel: "Cobertura por confirmar con la referencia oficial",
    demo: DEMO_METADATA,
  },
  {
    id: "demo-washer-12",
    slug: "lavadora-demo-12-kilos",
    name: "Lavadora demo 12 kg",
    model: "LAV-DEMO-12",
    category: "washer",
    categoryLabel: "Lavadoras",
    summary:
      "Ejemplo compacto para hogares que priorizan espacio y ciclos esenciales.",
    image: {
      src: "/images/product-placeholder.svg",
      alt: "Marcador de posición para una lavadora compacta de demostración",
      isPlaceholder: true,
    },
    price: {
      status: "unknown",
      label: "Precio por confirmar",
    },
    availability: {
      status: "demo-out-of-stock",
      label: "Agotado (demostración)",
    },
    features: [
      "Carga superior (demostración)",
      "Nivel de agua configurable (demostración)",
      "Ciclo rápido (demostración)",
    ],
    technologies: ["Tecnología de lavado por confirmar"],
    capacity: {
      value: 12,
      unit: "kg",
      label: "12 kg (dato demostrativo)",
    },
    dimensions: {
      widthCm: 59,
      heightCm: 96,
      depthCm: 61,
    },
    energyRating: "Consumo por confirmar",
    colors: [{ name: "Blanco", hex: "#F4F4F1" }],
    warrantyLabel: "Cobertura por confirmar con la referencia oficial",
    demo: DEMO_METADATA,
  },
  {
    id: "demo-stove-4",
    slug: "estufa-demo-cuatro-puestos",
    name: "Estufa demo 4 puestos",
    model: "EST-DEMO-4",
    category: "stove",
    categoryLabel: "Estufas",
    summary:
      "Ejemplo para explorar una configuración de cuatro puestos y horno.",
    image: {
      src: "/images/product-placeholder.svg",
      alt: "Marcador de posición para una estufa de demostración",
      isPlaceholder: true,
    },
    price: {
      status: "on-request",
      label: "Consultar precio",
    },
    availability: {
      status: "unknown",
      label: "Disponibilidad por confirmar",
    },
    features: [
      "Cuatro puestos (demostración)",
      "Horno con visor (demostración)",
      "Parrillas removibles (demostración)",
    ],
    technologies: ["Sistema de cocción por confirmar"],
    capacity: {
      value: 4,
      unit: "puestos",
      label: "4 puestos (dato demostrativo)",
    },
    dimensions: {
      widthCm: 60,
      heightCm: 94,
      depthCm: 66,
    },
    energyRating: "Consumo por confirmar",
    colors: [
      { name: "Negro", hex: "#171717" },
      { name: "Acero", hex: "#A8AAAD" },
    ],
    warrantyLabel: "Cobertura por confirmar con la referencia oficial",
    demo: DEMO_METADATA,
  },
  {
    id: "demo-water-heater-10",
    slug: "calentador-demo-10-galones",
    name: "Calentador demo 10 gal",
    model: "CAL-DEMO-10",
    category: "water-heater",
    categoryLabel: "Calentadores",
    summary:
      "Ejemplo de calentador para orientar la selección según el hogar.",
    image: {
      src: "/images/product-placeholder.svg",
      alt: "Marcador de posición para un calentador de demostración",
      isPlaceholder: true,
    },
    price: {
      status: "unknown",
      label: "Precio por confirmar",
    },
    availability: {
      status: "unknown",
      label: "Disponibilidad por confirmar",
    },
    features: [
      "Control de temperatura (demostración)",
      "Indicador de funcionamiento (demostración)",
      "Configuración de instalación por validar",
    ],
    technologies: ["Sistema de calentamiento por confirmar"],
    capacity: {
      value: 10,
      unit: "gal",
      label: "10 gal (dato demostrativo)",
    },
    dimensions: {
      widthCm: 39,
      heightCm: 62,
      depthCm: 38,
    },
    energyRating: "Consumo por confirmar",
    colors: [{ name: "Blanco", hex: "#F4F4F1" }],
    warrantyLabel: "Cobertura por confirmar con la referencia oficial",
    demo: DEMO_METADATA,
  },
  {
    id: "demo-air-conditioner-12000",
    slug: "aire-demo-12000-btu",
    name: "Aire acondicionado demo 12.000 BTU/h",
    model: "AIR-DEMO-12K",
    category: "air-conditioner",
    categoryLabel: "Aires acondicionados",
    summary:
      "Ejemplo para una habitación mediana; la capacidad final requiere validación.",
    image: {
      src: "/images/product-placeholder.svg",
      alt: "Marcador de posición para un aire acondicionado de demostración",
      isPlaceholder: true,
    },
    price: {
      status: "on-request",
      label: "Consultar precio",
    },
    availability: {
      status: "unknown",
      label: "Disponibilidad por confirmar",
    },
    features: [
      "Modo nocturno (demostración)",
      "Temporizador (demostración)",
      "Control remoto (demostración)",
    ],
    technologies: ["Tecnología de climatización por confirmar"],
    capacity: {
      value: 12000,
      unit: "BTU/h",
      label: "12.000 BTU/h (dato demostrativo)",
    },
    dimensions: {
      widthCm: 82,
      heightCm: 30,
      depthCm: 22,
    },
    energyRating: "Clasificación por confirmar",
    colors: [{ name: "Blanco", hex: "#F4F4F1" }],
    warrantyLabel: "Cobertura por confirmar con la referencia oficial",
    demo: DEMO_METADATA,
  },
  {
    id: "demo-air-conditioner-18000",
    slug: "aire-demo-18000-btu",
    name: "Aire acondicionado demo 18.000 BTU/h",
    model: "AIR-DEMO-18K",
    category: "air-conditioner",
    categoryLabel: "Aires acondicionados",
    summary:
      "Ejemplo de mayor capacidad para comparar espacios amplios.",
    image: {
      src: "/images/product-placeholder.svg",
      alt: "Marcador de posición para un aire acondicionado grande de demostración",
      isPlaceholder: true,
    },
    price: {
      status: "unknown",
      label: "Precio por confirmar",
    },
    availability: {
      status: "unknown",
      label: "Disponibilidad por confirmar",
    },
    features: [
      "Flujo de aire configurable (demostración)",
      "Temporizador (demostración)",
      "Filtro removible (demostración)",
    ],
    technologies: ["Tecnología de climatización por confirmar"],
    capacity: {
      value: 18000,
      unit: "BTU/h",
      label: "18.000 BTU/h (dato demostrativo)",
    },
    dimensions: {
      widthCm: 96,
      heightCm: 32,
      depthCm: 24,
    },
    energyRating: "Clasificación por confirmar",
    colors: [{ name: "Blanco", hex: "#F4F4F1" }],
    warrantyLabel: "Cobertura por confirmar con la referencia oficial",
    demo: DEMO_METADATA,
  },
] as const satisfies readonly Product[];

export const MOCK_PRODUCT_COMPARISON = {
  id: "demo-comparison-refrigerators",
  productIds: ["demo-refrigerator-420", "demo-refrigerator-300"],
  rows: [
    {
      key: "capacity",
      label: "Capacidad",
      values: {
        "demo-refrigerator-420": "420 L (demostración)",
        "demo-refrigerator-300": "300 L (demostración)",
      },
      importantDifference:
        "La opción de 420 L ofrece más espacio; valida las medidas disponibles en tu cocina.",
    },
    {
      key: "dimensions",
      label: "Dimensiones (an. × al. × prof.)",
      values: {
        "demo-refrigerator-420": "70 × 180 × 73 cm",
        "demo-refrigerator-300": "61 × 168 × 67 cm",
      },
      importantDifference:
        "La opción de 300 L ocupa menos espacio de frente y de fondo.",
    },
    {
      key: "energy",
      label: "Clasificación energética",
      values: {
        "demo-refrigerator-420": "Por confirmar",
        "demo-refrigerator-300": "Por confirmar",
      },
    },
    {
      key: "price",
      label: "Precio",
      values: {
        "demo-refrigerator-420": "Consultar precio",
        "demo-refrigerator-300": "Precio por confirmar",
      },
    },
    {
      key: "warranty",
      label: "Garantía",
      values: {
        "demo-refrigerator-420": "Por confirmar",
        "demo-refrigerator-300": "Por confirmar",
      },
    },
  ],
  recommendedProductId: "demo-refrigerator-420",
  recommendationReason:
    "En este ejemplo, encaja mejor con una familia de cuatro personas que prioriza capacidad. Confirma dimensiones, precio y ficha oficial antes de decidir.",
  demo: DEMO_METADATA,
} as const satisfies ProductComparison;

export const getMockProductById = (
  productId: string,
): Product | undefined =>
  MOCK_PRODUCTS.find((product) => product.id === productId);

export const getMockProductsByCategory = (
  category: ProductCategory,
): readonly Product[] =>
  MOCK_PRODUCTS.filter((product) => product.category === category);

