import { CalendarDays, CheckCircle2, FileText, Pencil, ScanLine, ShieldCheck } from 'lucide-react';
import { useId } from 'react';
import type { IdentifiedProduct } from '../../types/support';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

interface ProductIdentificationCardProps {
  readonly product: IdentifiedProduct;
  readonly onEdit?: (() => void) | undefined;
  readonly onOpenManual?: (() => void) | undefined;
}

export function ProductIdentificationCard({ product, onEdit, onOpenManual }: ProductIdentificationCardProps) {
  const cardId = useId();
  const titleId = `${cardId}-title`;
  const date = product.approximatePurchaseDate
    ? new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(
        new Date(`${product.approximatePurchaseDate}T12:00:00`),
      )
    : 'Por confirmar';

  return (
    <section className="identified-product" aria-labelledby={titleId}>
      <div className="identified-product__top">
        <span className="identified-product__icon" aria-hidden="true">
          <ScanLine size={24} />
        </span>
        <div>
          <span className="eyebrow">Producto identificado</span>
          <h3 id={titleId}>
            {product.typeLabel} · {product.model}
          </h3>
        </div>
        <Badge tone={product.warrantyStatus === 'active' ? 'lime' : 'neutral'}>
          <ShieldCheck size={13} aria-hidden="true" />
          {product.warrantyStatus === 'active' ? 'Garantía activa · demo' : 'Garantía por verificar'}
        </Badge>
      </div>
      <dl>
        <div>
          <dt>Número de serie</dt>
          <dd>{product.serialMasked}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays size={14} aria-hidden="true" />
            Compra aproximada
          </dt>
          <dd>{date}</dd>
        </div>
        <div>
          <dt>
            <FileText size={14} aria-hidden="true" />
            Manual
          </dt>
          <dd>{product.manualAvailable ? 'Disponible' : 'No encontrado'}</dd>
        </div>
      </dl>
      <div className="identified-product__actions">
        {product.manualAvailable && (
          <Button variant="secondary" icon={<FileText size={16} />} onClick={onOpenManual}>
            Consultar manual
          </Button>
        )}
        <Button variant="ghost" icon={<Pencil size={15} />} onClick={onEdit}>
          Corregir información
        </Button>
        <span className="identified-product__confirmed">
          <CheckCircle2 size={15} aria-hidden="true" />
          Información protegida
        </span>
      </div>
    </section>
  );
}
