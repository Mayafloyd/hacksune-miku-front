import { CheckCircle2, Sparkles, X } from 'lucide-react';
import { useId } from 'react';
import type { Product, ProductComparison as ProductComparisonData } from '../../types/product';
import { Badge } from '../common/Badge';

interface ProductComparisonProps {
  readonly products: readonly Product[];
  readonly comparison?: ProductComparisonData | undefined;
  readonly onRemove?: ((productId: string) => void) | undefined;
}

const fallbackRows = [
  { key: 'capacity', label: 'Capacidad' },
  { key: 'dimensions', label: 'Dimensiones' },
  { key: 'energy', label: 'Consumo' },
  { key: 'technologies', label: 'Tecnologías' },
  { key: 'warranty', label: 'Garantía' },
  { key: 'price', label: 'Precio' },
] as const;

function fallbackValue(product: Product, key: (typeof fallbackRows)[number]['key']) {
  if (key === 'capacity') return product.capacity.label;
  if (key === 'dimensions') {
    return `${product.dimensions.widthCm} × ${product.dimensions.heightCm} × ${product.dimensions.depthCm} cm`;
  }
  if (key === 'energy') return product.energyRating;
  if (key === 'technologies') return product.technologies;
  if (key === 'price') {
    return product.price.status === 'available'
      ? new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: product.price.currency,
          maximumFractionDigits: 0,
        }).format(product.price.amount)
      : product.price.label;
  }
  return product.warrantyLabel;
}

export function ProductComparison({ products, comparison, onRemove }: ProductComparisonProps) {
  const comparisonId = useId();
  const titleId = `${comparisonId}-title`;
  const isDemonstration = products.some((product) => product.demo);

  if (products.length < 2) {
    return (
      <section className="comparison-empty" aria-labelledby={titleId}>
        <span className="comparison-empty__count">{products.length}/3</span>
        <div>
          <h3 id={titleId}>Arma tu comparación</h3>
          <p>Elige al menos dos productos. Puedes comparar hasta tres opciones.</p>
        </div>
      </section>
    );
  }

  const rows = comparison?.rows ?? fallbackRows;

  return (
    <section className="comparison" aria-labelledby={titleId}>
      <header className="comparison__header">
        <div>
          <span className="eyebrow">Vista lado a lado</span>
          <h3 id={titleId}>Lo importante, sin letra pequeña</h3>
        </div>
        <Badge tone="lime">{products.length} productos</Badge>
      </header>
      <div className="comparison__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Característica</th>
              {products.map((product) => (
                <th scope="col" key={product.id}>
                  <span>{product.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemove?.(product.id)}
                    aria-label={`Quitar ${product.name} de la comparación`}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  {row.label}
                  {'importantDifference' in row && row.importantDifference && (
                    <span title={row.importantDifference}>
                      <Sparkles size={13} aria-hidden="true" />
                    </span>
                  )}
                </th>
                {products.map((product) => {
                  const value =
                    'values' in row
                      ? row.values[product.id]
                      : fallbackValue(product, row.key);
                  return <td key={product.id}>{Array.isArray(value) ? value.join(', ') : String(value ?? 'Por confirmar')}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comparison?.recommendedProductId && (
        <div className="comparison__recommendation">
          <CheckCircle2 size={18} aria-hidden="true" />
          <p>
            <strong>Recomendación del asesor.</strong>{' '}
            {comparison.recommendationReason ?? 'Esta opción se acerca más a lo que nos contaste.'}
          </p>
        </div>
      )}
      <p className="comparison__notice">
        {isDemonstration
          ? 'Comparación demostrativa. Confirma especificaciones, precio y disponibilidad en fuentes oficiales.'
          : 'Datos consultados en el catálogo oficial de Haceb; precio y disponibilidad pueden cambiar.'}
      </p>
    </section>
  );
}
