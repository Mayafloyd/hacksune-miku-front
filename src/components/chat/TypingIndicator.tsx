interface TypingIndicatorProps {
  readonly agent: 'sales' | 'support';
  readonly status?: 'thinking' | 'consulting' | 'streaming';
}

export function TypingIndicator({ agent, status = 'thinking' }: TypingIndicatorProps) {
  const label =
    status === 'streaming'
      ? 'Preparando la respuesta…'
      : agent === 'sales'
        ? 'Buscando opciones para ti…'
        : 'Revisando posibles causas…';

  return (
    <div className="typing-indicator" role="status" aria-live="polite">
      <span className={`agent-avatar agent-avatar--${agent}`} aria-hidden="true">
        <i />
      </span>
      <div>
        <span className="typing-indicator__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <small>{label}</small>
      </div>
    </div>
  );
}
