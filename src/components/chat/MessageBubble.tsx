import {
  Bot,
  Check,
  CheckCheck,
  Clipboard,
  ExternalLink,
  FileText,
  HardHat,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import type { AgentResponseBlock, ChatMessage } from '../../types/chat';
import type { Product } from '../../types/product';
import type { ServiceAppointment } from '../../types/support';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { ProductCarousel } from '../sales/ProductCarousel';
import { ProductComparison } from '../sales/ProductComparison';
import { DiagnosticSteps } from '../support/DiagnosticSteps';
import { SafetyAlert } from '../support/SafetyAlert';
import { ServiceConfirmation } from '../support/ServiceConfirmation';
import { ServiceScheduler } from '../support/ServiceScheduler';
import { WarrantyCard } from '../support/WarrantyCard';

interface MessageBubbleProps {
  readonly message: ChatMessage;
  readonly comparisonIds?: readonly string[];
  readonly onCompare?: ((product: Product) => void) | undefined;
  readonly onSave?: ((product: Product) => void) | undefined;
  readonly onIntent?: ((intent: string, label?: string) => void) | undefined;
  readonly onToast?: ((message: string) => void) | undefined;
  readonly onRetry?: (() => void) | undefined;
}

function messageTime(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function RichBlock({
  block,
  messageContent,
  comparisonIds,
  onCompare,
  onSave,
  onIntent,
  onToast,
}: {
  readonly block: AgentResponseBlock;
  readonly messageContent: string;
  readonly comparisonIds: readonly string[];
  readonly onCompare?: ((product: Product) => void) | undefined;
  readonly onSave?: ((product: Product) => void) | undefined;
  readonly onIntent?: ((intent: string, label?: string) => void) | undefined;
  readonly onToast?: ((message: string) => void) | undefined;
}) {
  const [appointment, setAppointment] = useState<ServiceAppointment | null>(null);

  if (block.type === 'text') {
    if (block.text.trim() === messageContent.trim()) return null;
    return <p className="message-block-text">{block.text}</p>;
  }

  if (block.type === 'product-list') {
    if (block.products.length === 0) {
      return (
        <EmptyState
          title="Sin coincidencias exactas"
          description={block.emptyMessage ?? 'Podemos ajustar algunas características para ampliar las opciones.'}
          action={
            <Button variant="secondary" onClick={() => onIntent?.('sales.adjust-search', 'Ajustar búsqueda')}>
              Ajustar búsqueda
            </Button>
          }
        />
      );
    }
    return (
      <ProductCarousel
        title={block.title}
        products={block.products}
        comparisonIds={comparisonIds}
        onCompare={onCompare}
        onInterested={(product) => onIntent?.('sales.interested', `Me interesa ${product.name}`)}
        onSave={onSave}
        onDetails={(product) => onIntent?.('sales.details', `Quiero conocer más detalles de ${product.name}`)}
      />
    );
  }

  if (block.type === 'product-comparison') {
    return (
      <ProductComparison
        products={block.products}
        comparison={block.comparison}
        onRemove={(productId) => {
          const product = block.products.find((item) => item.id === productId);
          if (product) onCompare?.(product);
        }}
      />
    );
  }

  if (block.type === 'diagnostic') {
    return (
      <DiagnosticSteps
        diagnostic={block.diagnostic}
        onChoice={(choice) => onToast?.(choice === 'worked' ? 'Marcamos este paso como resuelto.' : 'Respuesta guardada.')}
        onEscalate={() => onIntent?.('support.request-technician', 'Quiero solicitar un técnico')}
      />
    );
  }

  if (block.type === 'safety-alert') {
    return (
      <SafetyAlert
        alert={block.alert}
        onAction={() => onIntent?.('support.request-technician', block.alert.actionLabel)}
      />
    );
  }

  if (block.type === 'warranty') {
    return (
      <WarrantyCard
        warranty={block.warranty}
        onVerify={() => onIntent?.('support.verify-warranty', 'Quiero verificar la garantía')}
      />
    );
  }

  if (block.type === 'form') {
    if (appointment) return <ServiceConfirmation appointment={appointment} onManage={() => onToast?.('Abrimos la gestión de la solicitud.')} />;
    return <ServiceScheduler onComplete={setAppointment} />;
  }

  if (block.type === 'appointment') {
    return (
      <ServiceConfirmation
        appointment={block.appointment}
        onManage={() => onIntent?.('support.reschedule', 'Quiero consultar o reprogramar la visita')}
      />
    );
  }

  return (
    <section className="handoff-card">
      <span aria-hidden="true">
        <HardHat size={23} />
      </span>
      <div>
        <h3>{block.title}</h3>
        <p>{block.message}</p>
      </div>
      <Button variant="dark" onClick={() => onIntent?.('support.handoff', block.actionLabel)}>
        {block.actionLabel}
      </Button>
    </section>
  );
}

export function MessageBubble({
  message,
  comparisonIds = [],
  onCompare,
  onSave,
  onIntent,
  onToast,
  onRetry,
}: MessageBubbleProps) {
  const [feedback, setFeedback] = useState(message.feedback);
  const [copied, setCopied] = useState(false);
  const isUser = message.author === 'user';
  const isSystem = message.author === 'system';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      onToast?.('Mensaje copiado.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onToast?.('No pudimos copiar el mensaje. Selecciónalo manualmente.');
    }
  };

  if (isSystem) {
    return (
      <div className={`system-message system-message--${message.deliveryStatus}`} role="status">
        <span>{message.content}</span>
        {message.deliveryStatus === 'failed' && (
          <button type="button" onClick={onRetry}>
            <RotateCcw size={14} aria-hidden="true" />
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return (
    <article className={`chat-message ${isUser ? 'chat-message--user' : 'chat-message--agent'}`}>
      <span className={`message-avatar ${isUser ? 'message-avatar--user' : `message-avatar--${message.agent}`}`} aria-hidden="true">
        {isUser ? <UserRound size={17} /> : <Bot size={17} />}
      </span>
      <div className="chat-message__body">
        <header>
          <strong>{message.authorLabel}</strong>
          <time dateTime={message.createdAt}>{messageTime(message.createdAt)}</time>
          {message.deliveryStatus === 'streaming' && <span>Escribiendo…</span>}
        </header>
        <div className="chat-message__bubble">
          <p className="chat-message__content">{message.content}</p>
          {message.attachments && message.attachments.length > 0 && (
            <div className="message-attachments">
              {message.attachments.map((attachment) => (
                <span key={attachment.id}>
                  {attachment.previewUrl ? (
                    <img src={attachment.previewUrl} alt="" />
                  ) : (
                    <FileText size={15} aria-hidden="true" />
                  )}
                  {attachment.name}
                </span>
              ))}
            </div>
          )}
          {!isUser &&
            message.blocks?.map((block) => (
              <RichBlock
                key={block.id}
                block={block}
                messageContent={message.content}
                comparisonIds={comparisonIds}
                onCompare={onCompare}
                onSave={onSave}
                onIntent={onIntent}
                onToast={onToast}
              />
            ))}
          {!isUser && message.actions && message.actions.length > 0 && (
            <div className="message-actions">
              {message.actions.map((action) => (
                <Button
                  key={action.id}
                  variant={
                    action.emphasis === 'primary'
                      ? 'primary'
                      : action.emphasis === 'danger'
                        ? 'danger'
                        : 'secondary'
                  }
                  onClick={() => onIntent?.(action.intent, action.label)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="message-sources">
              <span>Fuentes</span>
              {message.sources.map((source) =>
                source.url ? (
                  <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                    {source.label}
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : (
                  <span key={source.id}>{source.label}</span>
                ),
              )}
            </div>
          )}
        </div>
        <footer className="chat-message__footer">
          {isUser ? (
            <span className="delivery-status">
              {message.deliveryStatus === 'sent' ? <CheckCheck size={14} /> : <Check size={14} />}
              {message.deliveryStatus === 'sent' ? 'Enviado' : 'Enviando'}
            </span>
          ) : (
            <>
              <button type="button" onClick={copy} aria-label="Copiar respuesta">
                {copied ? <Check size={14} /> : <Clipboard size={14} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <span aria-hidden="true">·</span>
              <span>¿Te sirvió?</span>
              <button
                type="button"
                className={feedback === 'positive' ? 'is-selected' : ''}
                onClick={() => {
                  setFeedback('positive');
                  onToast?.('Gracias por tu valoración.');
                }}
                aria-label="La respuesta fue útil"
                aria-pressed={feedback === 'positive'}
              >
                <ThumbsUp size={14} />
              </button>
              <button
                type="button"
                className={feedback === 'negative' ? 'is-selected' : ''}
                onClick={() => {
                  setFeedback('negative');
                  onToast?.('Gracias. Usaremos tu comentario para mejorar.');
                }}
                aria-label="La respuesta no fue útil"
                aria-pressed={feedback === 'negative'}
              >
                <ThumbsDown size={14} />
              </button>
            </>
          )}
        </footer>
      </div>
    </article>
  );
}
