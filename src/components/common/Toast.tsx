import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useEffect } from 'react';

export type ToastTone = 'success' | 'warning' | 'info';

interface ToastProps {
  readonly message: string;
  readonly tone?: ToastTone;
  readonly visible: boolean;
  readonly onDismiss: () => void;
}

export function Toast({ message, tone = 'success', visible, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timeout = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(timeout);
  }, [visible, onDismiss]);

  if (!visible) return null;
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? TriangleAlert : Info;

  return (
    <div className={`toast toast--${tone}`} role="status">
      <Icon size={19} aria-hidden="true" />
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Cerrar notificación">
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
