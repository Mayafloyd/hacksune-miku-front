import { ShieldAlert, Siren, TriangleAlert } from 'lucide-react';
import type { SafetyAlert as SafetyAlertData } from '../../types/support';
import { Button } from '../common/Button';

interface SafetyAlertProps {
  readonly alert: SafetyAlertData;
  readonly onAction?: () => void;
}

export function SafetyAlert({ alert, onAction }: SafetyAlertProps) {
  const Icon = alert.severity === 'critical' ? Siren : alert.severity === 'warning' ? TriangleAlert : ShieldAlert;

  return (
    <section className={`safety-alert safety-alert--${alert.severity}`} role="alert">
      <span className="safety-alert__icon" aria-hidden="true">
        <Icon size={25} />
      </span>
      <div>
        <span className="eyebrow">Tu seguridad va primero</span>
        <h3>{alert.title}</h3>
        <p>{alert.message}</p>
      </div>
      <Button variant="danger" onClick={onAction}>
        {alert.actionLabel}
      </Button>
    </section>
  );
}
