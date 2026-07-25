import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useRef } from 'react';
import type { Product } from '../../types/product';
import { ProductCard } from './ProductCard';

interface ProductCarouselProps {
  readonly title: string;
  readonly products: readonly Product[];
  readonly comparisonIds?: readonly string[];
  readonly onCompare?: ((product: Product) => void) | undefined;
  readonly onInterested?: ((product: Product) => void) | undefined;
  readonly onSave?: ((product: Product) => void) | undefined;
  readonly onDetails?: ((product: Product) => void) | undefined;
}

export function ProductCarousel({
  title,
  products,
  comparisonIds = [],
  onCompare,
  onInterested,
  onSave,
  onDetails,
}: ProductCarouselProps) {
  const carouselId = useId();
  const titleId = `${carouselId}-title`;
  const trackId = `${carouselId}-track`;
  const trackRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({ left: direction * 340, behavior: 'smooth' });
  };

  return (
    <section className="product-carousel" aria-labelledby={titleId}>
      <header className="product-carousel__header">
        <div>
          <span className="eyebrow">Opciones para explorar</span>
          <h3 id={titleId}>{title}</h3>
        </div>
        <div className="product-carousel__controls" aria-label="Controles del carrusel">
          <button
            className="icon-button"
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Anterior"
            aria-controls={trackId}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => scroll(1)}
            aria-label="Siguiente"
            aria-controls={trackId}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="product-carousel__track" id={trackId} ref={trackRef}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            compact
            selectedForComparison={comparisonIds.includes(product.id)}
            onCompare={onCompare}
            onInterested={onInterested}
            onSave={onSave}
            onDetails={onDetails}
          />
        ))}
      </div>
    </section>
  );
}
