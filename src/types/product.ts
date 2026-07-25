import type { DemonstrationMetadata } from "./agent";

export const PRODUCT_CATEGORIES = [
  "refrigerator",
  "washer",
  "stove",
  "water-heater",
  "air-conditioner",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type ProductCategoryLabel =
  | "Neveras"
  | "Lavadoras"
  | "Estufas"
  | "Calentadores"
  | "Aires acondicionados";

export type ProductPrice =
  | {
      readonly status: "available";
      readonly amount: number;
      readonly currency: "COP";
      readonly previousAmount?: number;
      readonly source: "official-api";
      readonly updatedAt: string;
    }
  | {
      readonly status: "on-request" | "unknown";
      readonly label: "Consultar precio" | "Precio por confirmar";
    };

export type ProductAvailability =
  | {
      readonly status: "in-stock" | "low-stock" | "out-of-stock";
      readonly label: string;
      readonly source: "official-api";
      readonly updatedAt: string;
    }
  | {
      readonly status: "unknown";
      readonly label: "Disponibilidad por confirmar";
    }
  | {
      /**
       * Permite probar el estado de agotado sin comunicar inventario real.
       */
      readonly status: "demo-out-of-stock";
      readonly label: "Agotado (demostración)";
    };

export interface ProductImage {
  readonly src: string;
  readonly alt: string;
  readonly isPlaceholder: boolean;
}

export interface ProductCapacity {
  readonly value: number;
  readonly unit: "L" | "kg" | "gal" | "BTU/h" | "puestos";
  readonly label: string;
}

export interface ProductDimensions {
  readonly widthCm: number;
  readonly heightCm: number;
  readonly depthCm: number;
}

export interface ProductColor {
  readonly name: string;
  readonly hex?: `#${string}`;
}

export interface ProductRating {
  readonly score: number;
  readonly scale: 5;
  readonly reviewCount: number;
  readonly source: "demonstration" | "official-api";
}

export interface Product {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly model: string;
  readonly category: ProductCategory;
  readonly categoryLabel: ProductCategoryLabel;
  readonly summary: string;
  readonly image: ProductImage;
  readonly price: ProductPrice;
  readonly availability: ProductAvailability;
  readonly features: readonly string[];
  readonly technologies: readonly string[];
  readonly capacity: ProductCapacity;
  readonly dimensions: ProductDimensions;
  readonly energyRating: string;
  readonly colors: readonly ProductColor[];
  readonly rating?: ProductRating;
  readonly warrantyLabel: string;
  readonly demo?: DemonstrationMetadata;
}

export interface ProductSearchCriteria {
  readonly query?: string;
  readonly category?: ProductCategory;
  readonly capacityMin?: number;
  readonly capacityMax?: number;
  readonly energyRating?: string;
  readonly availableOnly?: boolean;
}

export type ComparisonValue =
  | string
  | number
  | boolean
  | null
  | readonly string[];

export interface ProductComparisonRow {
  readonly key: string;
  readonly label: string;
  readonly values: Readonly<Record<string, ComparisonValue>>;
  readonly importantDifference?: string;
}

export interface ProductComparison {
  readonly id: string;
  readonly productIds: readonly [string, string, ...string[]];
  readonly rows: readonly ProductComparisonRow[];
  readonly recommendedProductId?: string;
  readonly recommendationReason?: string;
  readonly demo?: DemonstrationMetadata;
}

export const isProductCategory = (
  value: unknown,
): value is ProductCategory =>
  typeof value === "string" &&
  (PRODUCT_CATEGORIES as readonly string[]).includes(value);
