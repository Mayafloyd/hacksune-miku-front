import {
  ArrowUpRight,
  Bookmark,
  Check,
  GitCompareArrows,
  Heart,
  PackageCheck,
  Star,
} from 'lucide-react';
import { useState } from 'react';
import type { Product } from '../../types/product';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

interface ProductCardProps {
  readonly product: Product;
  readonly compact?: boolean;
  readonly selectedForComparison?: boolean;
  readonly onCompare?: ((product: Product) => void) | undefined;
  readonly onInterested?: ((product: Product) => void) | undefined;
  readonly onSave?: ((product: Product) => void) | undefined;
  readonly onDetails?: ((product: Product) => void) | undefined;
}

function productPrice(product: Product) {
  if (product.price.status !== 'available') return product.price.label;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: product.price.currency,
    maximumFractionDigits: 0,
  }).format(product.price.amount);
}

export function ProductCard({
  product,
  compact = false,
  selectedForComparison = false,
  onCompare,
  onInterested,
  onSave,
  onDetails,
}: ProductCardProps) {
  const [saved, setSaved] = useState(false);
  const unavailable =
    product.availability.status === 'out-of-stock' ||
    product.availability.status === 'demo-out-of-stock';

  const handleSave = () => {
    setSaved((value) => !value);
    onSave?.(product);
  };

  return (
    <article className={`product-card ${compact ? 'product-card--compact' : ''}`}>
      <div className="product-card__visual">
        <img src={product.image.src} alt={product.image.alt} width="520" height="420" loading="lazy" />
        <span className="dev-label">
          {product.demo ? 'Datos demo' : 'Catálogo oficial Haceb'}
        </span>
        <button
          className={`product-card__save ${saved ? 'is-saved' : ''}`}
          type="button"
          onClick={handleSave}
          aria-label={saved ? `Quitar ${product.name} de guardados` : `Guardar ${product.name}`}
          aria-pressed={saved}
        >
          <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>

      <div className="product-card__content">
        <div className="product-card__meta">
          <span>{product.categoryLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{product.model}</span>
        </div>
        <h3>{product.name}</h3>
        <p className="product-card__summary">{product.summary}</p>

        <div className="product-card__price-row">
          <span className="product-card__price">
            <strong>{productPrice(product)}</strong>
            {product.price.status === 'available' && product.price.previousAmount && (
              <del>
                {new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: product.price.currency,
                  maximumFractionDigits: 0,
                }).format(product.price.previousAmount)}
              </del>
            )}
          </span>
          {product.rating && (
            <span className="product-card__rating" aria-label={`${product.rating.score} de 5`}>
              <Star size={14} fill="currentColor" aria-hidden="true" />
              {product.rating.score}
            </span>
          )}
        </div>

        <div className="product-card__facts">
          <Badge tone="lime">{product.capacity.label.replace(' (dato demostrativo)', '')}</Badge>
          <Badge>{product.energyRating}</Badge>
        </div>

        <div className="product-card__colors" aria-label="Colores disponibles">
          {product.colors.map((color) => (
            <span key={color.name} title={color.name}>
              <i style={{ background: color.hex ?? 'var(--brand-border)' }} aria-hidden="true" />
              <small>{color.name}</small>
            </span>
          ))}
        </div>

        {!compact && (
          <ul className="product-card__features">
            {product.features.slice(0, 3).map((feature) => (
              <li key={feature}>
                <Check size={14} aria-hidden="true" />
                <span>{feature.replace(' (demostración)', '')}</span>
              </li>
            ))}
          </ul>
        )}

        <div className={`availability availability--${unavailable ? 'unavailable' : 'unknown'}`}>
          <PackageCheck size={15} aria-hidden="true" />
          <span>{product.availability.label}</span>
        </div>

        <div className="product-card__actions">
          <Button
            variant={selectedForComparison ? 'dark' : 'secondary'}
            icon={selectedForComparison ? <Check size={16} /> : <GitCompareArrows size={16} />}
            onClick={() => onCompare?.(product)}
            aria-pressed={selectedForComparison}
          >
            {selectedForComparison ? 'En comparación' : 'Comparar'}
          </Button>
          <Button
            variant="primary"
            icon={<Heart size={16} />}
            onClick={() => onInterested?.(product)}
            disabled={unavailable}
          >
            Me interesa
          </Button>
        </div>
        <button className="product-card__details" type="button" onClick={() => onDetails?.(product)}>
          Ver detalles
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
