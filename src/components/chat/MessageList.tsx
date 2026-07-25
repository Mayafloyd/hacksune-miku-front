import { Headphones, ShoppingBag, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { AgentType } from '../../types/agent';
import type { ChatMessage } from '../../types/chat';
import type { Product } from '../../types/product';
import { Button } from '../common/Button';
import { Skeleton } from '../common/Skeleton';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  readonly agent: AgentType;
  readonly messages: readonly ChatMessage[];
  readonly quickActions: readonly string[];
  readonly isLoading: boolean;
  readonly comparisonIds: readonly string[];
  readonly onQuickAction: (action: string) => void;
  readonly onCompare: (product: Product) => void;
  readonly onSave: (product: Product) => void;
  readonly onIntent: (intent: string, label?: string) => void;
  readonly onToast: (message: string) => void;
  readonly onRetry?: (() => void) | undefined;
}

export function MessageList({
  agent,
  messages,
  quickActions,
  isLoading,
  comparisonIds,
  onQuickAction,
  onCompare,
  onSave,
  onIntent,
  onToast,
  onRetry,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length <= 1 && !isLoading) return;
    endRef.current?.scrollIntoView({ behavior: isLoading ? 'smooth' : 'auto', block: 'end' });
  }, [messages.length, isLoading]);

  const Icon = agent === 'sales' ? ShoppingBag : Headphones;
  const hasOnlyWelcome = messages.length <= 1;

  return (
    <div className="message-list" aria-label="Conversación">
      {hasOnlyWelcome && (
        <section className={`conversation-intro conversation-intro--${agent}`}>
          <div className="conversation-intro__mark">
            <Icon size={29} aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
          <span className="eyebrow">{agent === 'sales' ? 'Compra con más claridad' : 'Acompañamiento seguro'}</span>
          <h2>
            {agent === 'sales' ? 'Encontremos lo que sí cabe en tu vida.' : 'Cuéntanos qué está pasando.'}
          </h2>
          <p>
            {agent === 'sales'
              ? 'Te haré preguntas cortas sobre espacio, uso y prioridades. No mostraré precios ni inventario sin una fuente oficial.'
              : 'Revisaremos causas sencillas sin pedirte abrir el equipo. Si hay riesgo, pasaremos directo a ayuda profesional.'}
          </p>
          <div className="quick-prompts" aria-label="Acciones rápidas">
            {quickActions.map((action, index) => (
              <button type="button" key={action} onClick={() => onQuickAction(action)}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {action}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            icon={<Sparkles size={16} />}
            onClick={() => onQuickAction(agent === 'sales' ? 'Ayúdame a empezar' : 'No conozco la referencia de mi producto')}
          >
            No sé por dónde empezar
          </Button>
        </section>
      )}

      <div className="message-list__thread">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            comparisonIds={comparisonIds}
            onCompare={onCompare}
            onSave={onSave}
            onIntent={onIntent}
            onToast={onToast}
            onRetry={onRetry}
          />
        ))}
        {isLoading && !messages.some((message) => message.deliveryStatus === 'streaming') && (
          <>
            <TypingIndicator agent={agent} />
            <div className="message-loading-preview" aria-hidden="true">
              <Skeleton lines={3} variant={agent === 'sales' ? 'product' : 'card'} />
            </div>
          </>
        )}
        <div ref={endRef} aria-hidden="true" />
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {isLoading ? 'El agente está preparando una respuesta.' : messages.length > 1 ? 'La respuesta está lista.' : ''}
      </span>
    </div>
  );
}
