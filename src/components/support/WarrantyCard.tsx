import { CalendarCheck, FileCheck2, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { Warranty } from '../../types/support';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

interface WarrantyCardProps {
  readonly warranty: Warranty;
  readonly onVerify?: () => void;
}

function formatDate(value?: string) {
  if (!value) return 'Por confirmar';
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

export function WarrantyCard({ warranty, onVerify }: WarrantyCardProps) {
  const active = warranty.status === 'active';
  return (
    <section className={`warranty-card ${active ? 'is-active' : ''}`}>
      <header>
        <span className="warranty-card__icon" aria-hidden="true">
          {active ? <ShieldCheck size={24} /> : <ShieldQuestion size={24} />}
        </span>
        <div>
          <span className="eyebrow">Estado de garantía · demostración</span>
          <h3>{warranty.productLabel}</h3>
          <p>
            {warranty.model} · {warranty.serialMasked}
          </p>
        </div>
        <Badge tone={active ? 'lime' : 'neutral'}>{warranty.statusLabel}</Badge>
      </header>
      <div className="warranty-card__dates">
        <div>
          <FileCheck2 size={17} aria-hidden="true" />
          <span>Compra</span>
          <strong>{formatDate(warranty.purchaseDate)}</strong>
        </div>
        <div>
          <CalendarCheck size={17} aria-hidden="true" />
          <span>Cobertura hasta</span>
          <strong>{formatDate(warranty.coverageEndDate)}</strong>
        </div>
      </div>
      <p>{warranty.coverageSummary}</p>
      {warranty.nextAction && <small>{warranty.nextAction}</small>}
      <Button variant={active ? 'secondary' : 'primary'} onClick={onVerify}>
        {active ? 'Ver condiciones' : 'Verificar información'}
      </Button>
    </section>
  );
}
