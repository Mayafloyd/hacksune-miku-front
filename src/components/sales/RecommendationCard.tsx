import { ArrowRight, Award, CheckCircle2 } from 'lucide-react';
import type { Product } from '../../types/product';
import { Button } from '../common/Button';

interface RecommendationCardProps {
  readonly product: Product;
  readonly reason?: string;
  readonly onInterested?: (product: Product) => void;
}

export function RecommendationCard({ product, reason, onInterested }: RecommendationCardProps) {
  return (
    <section className="recommendation-card">
      <div className="recommendation-card__mark" aria-hidden="true">
        <Award size={27} />
      </div>
      <div className="recommendation-card__copy">
        <span className="eyebrow">Esta sería mi recomendación principal</span>
        <h3>{product.name}</h3>
        <p>
          {reason ??
            `Por su capacidad de ${product.capacity.label.replace(' (dato demostrativo)', '')} y su tamaño, es la alternativa que mejor equilibra espacio y uso diario.`}
        </p>
        <ul>
          {product.features.slice(0, 2).map((feature) => (
            <li key={feature}>
              <CheckCircle2 size={15} aria-hidden="true" />
              {feature.replace(' (demostración)', '')}
            </li>
          ))}
        </ul>
      </div>
      <div className="recommendation-card__action">
        <span className="dev-label">Recomendación demo</span>
        <Button
          variant="primary"
          trailingIcon={<ArrowRight size={17} />}
          onClick={() => onInterested?.(product)}
        >
          Revisar esta opción
        </Button>
      </div>
    </section>
  );
}
