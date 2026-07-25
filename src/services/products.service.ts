import {
  MOCK_PRODUCT_COMPARISON,
  MOCK_PRODUCTS,
} from "../data/mock-products";
import type {
  ComparisonValue,
  Product,
  ProductComparison,
  ProductSearchCriteria,
} from "../types/product";

export interface ProductsRepository {
  findAll(signal?: AbortSignal): Promise<readonly Product[]>;
  findById(
    productId: string,
    signal?: AbortSignal,
  ): Promise<Product | undefined>;
}

export class ProductServiceError extends Error {
  readonly code:
    | "invalid-comparison"
    | "product-not-found"
    | "request-cancelled";

  constructor(code: ProductServiceError["code"], message: string) {
    super(message);
    this.name = "ProductServiceError";
    this.code = code;
  }
}

const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new ProductServiceError(
      "request-cancelled",
      "La consulta de productos fue cancelada.",
    );
  }
};

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO");

const matchesQuery = (product: Product, query: string): boolean => {
  const searchableText = [
    product.name,
    product.model,
    product.categoryLabel,
    product.summary,
    ...product.features,
    ...product.technologies,
  ]
    .map(normalize)
    .join(" ");

  return searchableText.includes(normalize(query));
};

const matchesCriteria = (
  product: Product,
  criteria: ProductSearchCriteria,
): boolean => {
  if (
    criteria.query &&
    !matchesQuery(product, criteria.query.trim())
  ) {
    return false;
  }
  if (criteria.category && product.category !== criteria.category) {
    return false;
  }
  if (
    criteria.capacityMin !== undefined &&
    product.capacity.value < criteria.capacityMin
  ) {
    return false;
  }
  if (
    criteria.capacityMax !== undefined &&
    product.capacity.value > criteria.capacityMax
  ) {
    return false;
  }
  if (
    criteria.energyRating &&
    product.energyRating !== criteria.energyRating
  ) {
    return false;
  }
  if (
    criteria.availableOnly &&
    product.availability.status !== "in-stock"
  ) {
    return false;
  }
  return true;
};

const priceLabel = (product: Product): string => {
  if (product.price.status !== "available") return product.price.label;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: product.price.currency,
    maximumFractionDigits: 0,
  }).format(product.price.amount);
};

const recordValues = (
  products: readonly Product[],
  getValue: (product: Product) => ComparisonValue,
): Readonly<Record<string, ComparisonValue>> =>
  Object.fromEntries(
    products.map((product) => [product.id, getValue(product)]),
  );

const buildComparison = (
  products: readonly [Product, Product, ...Product[]],
): ProductComparison => {
  const demo = products.find((product) => product.demo)?.demo;
  return {
    id: `comparison-${products.map((product) => product.id).join("-")}`,
    productIds: products.map((product) => product.id) as [
      string,
      string,
      ...string[],
    ],
    rows: [
      {
        key: "capacity",
        label: "Capacidad",
        values: recordValues(
          products,
          (product) => product.capacity.label,
        ),
        importantDifference:
          "Compara la capacidad con el número de personas y la frecuencia de uso en tu hogar.",
      },
      {
        key: "dimensions",
        label: "Dimensiones (an. × al. × prof.)",
        values: recordValues(
          products,
          ({ dimensions }) =>
            `${dimensions.widthCm} × ${dimensions.heightCm} × ${dimensions.depthCm} cm`,
        ),
        importantDifference:
          "Deja el espacio de ventilación indicado en la ficha oficial.",
      },
      {
        key: "energy",
        label: "Clasificación energética",
        values: recordValues(
          products,
          (product) => product.energyRating,
        ),
      },
      {
        key: "technologies",
        label: "Tecnologías",
        values: recordValues(
          products,
          (product) => product.technologies,
        ),
      },
      {
        key: "price",
        label: "Precio",
        values: recordValues(products, priceLabel),
      },
      {
        key: "warranty",
        label: "Garantía",
        values: recordValues(
          products,
          (product) => product.warrantyLabel,
        ),
      },
    ],
    ...(demo ? { demo } : {}),
  };
};

export class MockProductsRepository implements ProductsRepository {
  async findAll(signal?: AbortSignal): Promise<readonly Product[]> {
    assertNotAborted(signal);
    return Promise.resolve(MOCK_PRODUCTS);
  }

  async findById(
    productId: string,
    signal?: AbortSignal,
  ): Promise<Product | undefined> {
    assertNotAborted(signal);
    return Promise.resolve(
      MOCK_PRODUCTS.find((product) => product.id === productId),
    );
  }
}

export class ProductsService {
  constructor(private readonly repository: ProductsRepository) {}

  async search(
    criteria: ProductSearchCriteria = {},
    signal?: AbortSignal,
  ): Promise<readonly Product[]> {
    const products = await this.repository.findAll(signal);
    assertNotAborted(signal);
    return products.filter((product) =>
      matchesCriteria(product, criteria),
    );
  }

  async getById(
    productId: string,
    signal?: AbortSignal,
  ): Promise<Product | undefined> {
    return this.repository.findById(productId, signal);
  }

  async compare(
    productIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<ProductComparison> {
    const uniqueIds = [...new Set(productIds)];
    if (uniqueIds.length < 2 || uniqueIds.length > 3) {
      throw new ProductServiceError(
        "invalid-comparison",
        "Selecciona entre dos y tres productos para comparar.",
      );
    }

    const products = await Promise.all(
      uniqueIds.map((productId) =>
        this.repository.findById(productId, signal),
      ),
    );
    assertNotAborted(signal);

    const missingId = uniqueIds.find(
      (_productId, index) => !products[index],
    );
    if (missingId) {
      throw new ProductServiceError(
        "product-not-found",
        "Uno de los productos ya no está disponible para comparar.",
      );
    }

    const foundProducts = products as [
      Product,
      Product,
      ...Product[],
    ];
    const isDemoRefrigeratorComparison =
      uniqueIds.length === 2 &&
      MOCK_PRODUCT_COMPARISON.productIds.every((productId) =>
        uniqueIds.includes(productId),
      );

    return isDemoRefrigeratorComparison
      ? MOCK_PRODUCT_COMPARISON
      : buildComparison(foundProducts);
  }
}

export const productsService = new ProductsService(
  new MockProductsRepository(),
);
