import { Banknote, Home, Ruler, Sparkles, Users } from 'lucide-react';

interface SalesRequirementsProps {
  readonly category?: string;
  readonly household?: string;
  readonly space?: string;
  readonly budget?: string;
  readonly priorities?: readonly string[];
  readonly onEdit?: (() => void) | undefined;
}

export function SalesRequirements({
  category = 'Por definir',
  household = 'Por definir',
  space = 'Por definir',
  budget = 'Por definir',
  priorities = [],
  onEdit,
}: SalesRequirementsProps) {
  const items = [
    { icon: Home, label: 'Categoría', value: category },
    { icon: Users, label: 'Hogar', value: household },
    { icon: Ruler, label: 'Espacio', value: space },
    { icon: Banknote, label: 'Presupuesto', value: budget },
  ];

  return (
    <section className="requirements-card">
      <header>
        <div>
          <span className="eyebrow">Lo que entendí</span>
          <h3>Necesidades detectadas</h3>
        </div>
        <button type="button" onClick={onEdit}>Editar</button>
      </header>
      <dl>
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label}>
            <dt>
              <Icon size={15} aria-hidden="true" />
              {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="requirements-card__priorities">
        <span>
          <Sparkles size={14} aria-hidden="true" />
          Prioridades
        </span>
        <div>
          {priorities.length > 0 ? (
            priorities.map((priority) => (
              <span className="badge badge--lime" key={priority}>
                {priority}
              </span>
            ))
          ) : (
            <span className="badge">Aún por detectar</span>
          )}
        </div>
      </div>
    </section>
  );
}
