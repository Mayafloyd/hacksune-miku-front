import { AlertTriangle, GitCompareArrows, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MOCK_AGENTS } from '../../data/mock-agents';
import { MOCK_CONVERSATIONS } from '../../data/mock-conversations';
import { MOCK_PRODUCT_COMPARISON, MOCK_PRODUCTS } from '../../data/mock-products';
import { agentService } from '../../services/agent.service';
import type { AgentAvailability, AgentType } from '../../types/agent';
import type { ChatAttachment, ChatMessage, ChatRequest, Conversation } from '../../types/chat';
import type { Product } from '../../types/product';
import { AppSidebar } from '../layout/AppSidebar';
import { ContextPanel } from '../layout/ContextPanel';
import { Modal } from '../common/Modal';
import { Sheet } from '../common/Sheet';
import { Toast, type ToastTone } from '../common/Toast';
import { Button } from '../common/Button';
import { ProductComparison } from '../sales/ProductComparison';
import { ChatHeader } from './ChatHeader';
import { MessageComposer } from './MessageComposer';
import { MessageList } from './MessageList';

interface ChatWorkspaceProps {
  readonly initialAgent: AgentType;
}

interface ToastState {
  readonly message: string;
  readonly tone: ToastTone;
}

const INITIAL_TIMESTAMP = '2026-07-25T08:30:00-05:00';
const PRODUCT_CATALOG: readonly Product[] = MOCK_PRODUCTS;
const COMPARISON_PRODUCT_IDS: readonly string[] = MOCK_PRODUCT_COMPARISON.productIds;
const QUICK_ACTION_MESSAGES: Readonly<Record<string, string>> = {
  compare: 'Quiero comparar productos',
  warranty: 'Consultar mi garantía',
  schedule: 'Agendar una visita técnica',
  parts: 'Buscar un repuesto',
  'request-status': 'Consultar una solicitud',
};

function welcomeMessage(agent: AgentType): ChatMessage {
  return {
    id: `welcome-${agent}`,
    agent,
    author: 'agent',
    authorLabel: agent === 'sales' ? 'Asesor de ventas' : 'Experto técnico',
    createdAt: INITIAL_TIMESTAMP,
    content:
      agent === 'sales'
        ? 'Te ayudaré a encontrar una opción que se ajuste a tu espacio y a lo que necesitas.'
        : 'Vamos a revisar algunas causas sencillas y seguras antes de solicitar una visita.',
    deliveryStatus: 'sent',
    feedback: null,
  };
}

const initialThreads: Record<AgentType, readonly ChatMessage[]> = {
  sales: [welcomeMessage('sales')],
  support: [welcomeMessage('support')],
};

function messageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function ChatWorkspace({ initialAgent }: ChatWorkspaceProps) {
  const [agent, setAgent] = useState<AgentType>(initialAgent);
  const [threads, setThreads] = useState<Record<AgentType, readonly ChatMessage[]>>(initialThreads);
  const [statuses, setStatuses] = useState<Record<AgentType, AgentAvailability>>({
    sales: 'available',
    support: 'available',
  });
  const [loadingByAgent, setLoadingByAgent] = useState<Record<AgentType, boolean>>({
    sales: false,
    support: false,
  });
  const [conversations, setConversations] = useState<readonly Conversation[]>(MOCK_CONVERSATIONS);
  const [activeConversationIds, setActiveConversationIds] = useState<
    Record<AgentType, string | undefined>
  >({ sales: undefined, support: undefined });
  const [comparisonProducts, setComparisonProducts] = useState<readonly Product[]>([]);
  const [savedProducts, setSavedProducts] = useState<readonly Product[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [contextPlacement, setContextPlacement] = useState<'right' | 'bottom'>('bottom');
  const [toast, setToast] = useState<ToastState | null>(null);
  const lastMessageRef = useRef<Record<AgentType, string | null>>({ sales: null, support: null });
  const abortRefs = useRef<Record<AgentType, AbortController | null>>({
    sales: null,
    support: null,
  });

  const messages = threads[agent];
  const activeConversationId = activeConversationIds[agent];
  const currentStatus = online ? statuses[agent] : 'offline';
  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ message, tone });
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => {
      setOnline(true);
      showToast('Volviste a tener conexión.', 'info');
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'history') setHistoryOpen(true);
    setPendingAction(params.get('action'));
    if (params.get('topic') === 'help') {
      setToast({
        message: 'Puedes comenzar con una acción rápida o describir lo que necesitas.',
        tone: 'info',
      });
    }

    const updatePlacement = () => {
      setContextPlacement(window.matchMedia('(min-width: 52.01rem)').matches ? 'right' : 'bottom');
    };
    updatePlacement();
    window.addEventListener('resize', updatePlacement);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', updatePlacement);
      abortRefs.current.sales?.abort();
      abortRefs.current.support?.abort();
    };
  }, [showToast]);

  const switchAgent = useCallback((nextAgent: AgentType) => {
    setAgent(nextAgent);
    setHistoryOpen(false);
    setContextOpen(false);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `/assistant/${nextAgent}`);
      document.title = `${nextAgent === 'sales' ? 'Asesor de ventas' : 'Soporte técnico'} | HACEB`;
    }
  }, []);

  const patchMessage = useCallback(
    (targetAgent: AgentType, targetId: string, patcher: (message: ChatMessage) => ChatMessage) => {
      setThreads((current) => ({
        ...current,
        [targetAgent]: current[targetAgent].map((message) =>
          message.id === targetId ? patcher(message) : message,
        ),
      }));
    },
    [],
  );

  useEffect(() => {
    setConversations((current) =>
      current.map((conversation) => {
        if (activeConversationIds[conversation.agent] !== conversation.id) return conversation;
        const conversationMessages = threads[conversation.agent];
        const lastMessage = conversationMessages.at(-1);
        return {
          ...conversation,
          messages: conversationMessages,
          updatedAt: lastMessage?.createdAt ?? conversation.updatedAt,
        };
      }),
    );
  }, [activeConversationIds, threads]);

  const sendMessage = useCallback(
    async (rawMessage: string, attachments: readonly ChatAttachment[] = []) => {
      const message = rawMessage.trim();
      if (!message || loadingByAgent[agent] || !online) return;

      const targetAgent = agent;
      let conversationId = activeConversationIds[targetAgent];
      if (!conversationId) {
        conversationId = messageId(`conversation-${targetAgent}`);
        const createdAt = new Date().toISOString();
        const newConversation: Conversation = {
          id: conversationId,
          sessionId: `session-${conversationId}`,
          agent: targetAgent,
          title: message.length > 42 ? `${message.slice(0, 42)}…` : message,
          startedAt: createdAt,
          updatedAt: createdAt,
          group: 'today',
          context:
            targetAgent === 'sales'
              ? {
                  kind: 'sales',
                  priorities: [],
                  savedProductIds: [],
                  comparisonProductIds: [],
                }
              : {
                  kind: 'support',
                  symptoms: [],
                  attachmentIds: attachments.map((attachment) => attachment.id),
                },
          messages: threads[targetAgent],
        };
        setActiveConversationIds((current) => ({ ...current, [targetAgent]: conversationId }));
        setConversations((current) => [newConversation, ...current]);
      } else {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId && conversation.title === 'Nueva conversación'
              ? {
                  ...conversation,
                  title: message.length > 42 ? `${message.slice(0, 42)}…` : message,
                }
              : conversation,
          ),
        );
      }
      const userMessage: ChatMessage = {
        id: messageId('user'),
        agent: targetAgent,
        author: 'user',
        authorLabel: 'Tú',
        createdAt: new Date().toISOString(),
        content: message,
        attachments,
        deliveryStatus: 'sent',
      };
      const request: ChatRequest = {
        agent: targetAgent,
        sessionId: conversationId,
        message,
        productContext: {},
        attachments,
      };

      lastMessageRef.current[targetAgent] = message;
      setThreads((current) => ({
        ...current,
        [targetAgent]: [...current[targetAgent], userMessage],
      }));
      setLoadingByAgent((current) => ({ ...current, [targetAgent]: true }));
      setStatuses((current) => ({
        ...current,
        [targetAgent]: targetAgent === 'sales' ? 'consulting' : 'thinking',
      }));

      const controller = new AbortController();
      abortRefs.current[targetAgent] = controller;
      let responseMessageId = '';
      let responseFailed = false;

      try {
        for await (const event of agentService.stream(request, { signal: controller.signal })) {
          if (event.type === 'start') {
            responseMessageId = event.responseId;
            const pendingMessage: ChatMessage = {
              id: responseMessageId,
              agent: targetAgent,
              author: 'agent',
              authorLabel: targetAgent === 'sales' ? 'Asesor de ventas' : 'Experto técnico',
              createdAt: new Date().toISOString(),
              content: '',
              blocks: [],
              deliveryStatus: 'streaming',
              feedback: null,
            };
            setThreads((current) => ({
              ...current,
              [targetAgent]: [...current[targetAgent], pendingMessage],
            }));
          } else if (event.type === 'text-delta') {
            patchMessage(targetAgent, event.responseId, (current) => ({
              ...current,
              content: `${current.content}${event.delta}`,
            }));
          } else if (event.type === 'block') {
            patchMessage(targetAgent, event.responseId, (current) => ({
              ...current,
              blocks: [...(current.blocks ?? []), event.block],
            }));
          } else if (event.type === 'done') {
            patchMessage(targetAgent, event.response.id, (current) => ({
              ...current,
              content:
                current.content ||
                (event.response.blocks[0]?.type === 'text' ? event.response.blocks[0].text : ''),
              blocks: event.response.blocks,
              deliveryStatus: 'sent',
            }));
          } else if (event.type === 'error') {
            responseFailed = true;
            const errorMessage: ChatMessage = {
              id: messageId('system-error'),
              agent: targetAgent,
              author: 'system',
              authorLabel: 'Sistema',
              createdAt: new Date().toISOString(),
              content: event.message,
              deliveryStatus: event.retryable ? 'failed' : 'sent',
            };
            setThreads((current) => ({
              ...current,
              [targetAgent]: [...current[targetAgent], errorMessage],
            }));
            setStatuses((current) => ({
              ...current,
              [targetAgent]: event.code === 'offline' ? 'offline' : 'error',
            }));
          }
        }
      } catch {
        responseFailed = true;
        const fallbackError: ChatMessage = {
          id: messageId('system-error'),
          agent: targetAgent,
          author: 'system',
          authorLabel: 'Sistema',
          createdAt: new Date().toISOString(),
          content: 'No pudimos completar la consulta. Tu conversación sigue guardada y puedes intentarlo nuevamente.',
          deliveryStatus: 'failed',
        };
        setThreads((current) => ({
          ...current,
          [targetAgent]: [...current[targetAgent], fallbackError],
        }));
        setStatuses((current) => ({ ...current, [targetAgent]: 'error' }));
      } finally {
        setLoadingByAgent((current) => ({ ...current, [targetAgent]: false }));
        if (!responseFailed) {
          setStatuses((current) => ({ ...current, [targetAgent]: 'available' }));
        }
        abortRefs.current[targetAgent] = null;
      }
    },
    [activeConversationIds, agent, loadingByAgent, online, patchMessage, threads],
  );

  useEffect(() => {
    if (!pendingAction) return;
    const actionMessage = QUICK_ACTION_MESSAGES[pendingAction];
    setPendingAction(null);
    window.history.replaceState({}, '', window.location.pathname);
    if (actionMessage) void sendMessage(actionMessage);
  }, [pendingAction, sendMessage]);

  const toggleComparison = useCallback(
    (product: Product) => {
      setComparisonProducts((current) => {
        if (current.some((item) => item.id === product.id)) {
          showToast('Quitamos el producto de la comparación.', 'info');
          return current.filter((item) => item.id !== product.id);
        }
        if (current.length >= 3) {
          showToast('Puedes comparar máximo tres productos.', 'warning');
          return current;
        }
        showToast('Producto agregado a la comparación.');
        return [...current, product];
      });
    },
    [showToast],
  );

  const toggleSavedProduct = useCallback(
    (product: Product) => {
      setSavedProducts((current) => {
        if (current.some((item) => item.id === product.id)) {
          showToast('Quitamos el producto de guardados.', 'info');
          return current.filter((item) => item.id !== product.id);
        }
        showToast('Producto guardado en esta conversación.');
        return [...current, product];
      });
    },
    [showToast],
  );

  useEffect(() => {
    const salesConversationId = activeConversationIds.sales;
    if (!salesConversationId) return;
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === salesConversationId && conversation.context.kind === 'sales'
          ? {
              ...conversation,
              context: {
                ...conversation.context,
                comparisonProductIds: comparisonProducts.map((product) => product.id),
                savedProductIds: savedProducts.map((product) => product.id),
              },
            }
          : conversation,
      ),
    );
  }, [activeConversationIds.sales, comparisonProducts, savedProducts]);

  const selectConversation = (conversation: Conversation) => {
    setThreads((current) => ({ ...current, [conversation.agent]: conversation.messages }));
    setAgent(conversation.agent);
    setActiveConversationIds((current) => ({
      ...current,
      [conversation.agent]: conversation.id,
    }));
    if (conversation.context.kind === 'sales') {
      setComparisonProducts(
        conversation.context.comparisonProductIds
          .map((id) => PRODUCT_CATALOG.find((product) => product.id === id))
          .filter((product): product is Product => product !== undefined),
      );
      setSavedProducts(
        conversation.context.savedProductIds
          .map((id) => PRODUCT_CATALOG.find((product) => product.id === id))
          .filter((product): product is Product => product !== undefined),
      );
    }
    setHistoryOpen(false);
    window.history.replaceState({}, '', `/assistant/${conversation.agent}`);
  };

  const newConversation = () => {
    abortRefs.current[agent]?.abort();
    const createdAt = new Date().toISOString();
    const conversationId = messageId(`conversation-${agent}`);
    const conversation: Conversation = {
      id: conversationId,
      sessionId: `session-${conversationId}`,
      agent,
      title: 'Nueva conversación',
      startedAt: createdAt,
      updatedAt: createdAt,
      group: 'today',
      context:
        agent === 'sales'
          ? {
              kind: 'sales',
              priorities: [],
              savedProductIds: [],
              comparisonProductIds: [],
            }
          : {
              kind: 'support',
              symptoms: [],
              attachmentIds: [],
            },
      messages: [welcomeMessage(agent)],
    };
    setThreads((current) => ({ ...current, [agent]: [welcomeMessage(agent)] }));
    setConversations((current) => [conversation, ...current]);
    setActiveConversationIds((current) => ({ ...current, [agent]: conversationId }));
    if (agent === 'sales') {
      setComparisonProducts([]);
      setSavedProducts([]);
    }
    setHistoryOpen(false);
    showToast('Nueva conversación lista.', 'info');
  };

  const clearConversation = () => {
    setThreads((current) => ({ ...current, [agent]: [welcomeMessage(agent)] }));
    if (agent === 'sales') {
      setComparisonProducts([]);
      setSavedProducts([]);
    }
    setClearOpen(false);
    showToast('La conversación quedó limpia.', 'info');
  };

  const handleIntent = (intent: string, label?: string) => {
    if (intent === 'support.request-technician') {
      void sendMessage('Agendar una visita técnica');
    } else if (intent === 'support.handoff' || intent === 'sales.handoff') {
      void sendMessage('Quiero hablar con un asesor humano');
    } else if (intent === 'support.verify-warranty') {
      void sendMessage('Quiero verificar la garantía de mi producto');
    } else if (intent === 'support.reschedule') {
      void sendMessage('Quiero consultar o reprogramar mi visita técnica');
    } else if (intent === 'sales.adjust-search') {
      void sendMessage('Quiero ajustar las características de mi búsqueda');
    } else {
      void sendMessage(label ?? 'Quiero continuar con esta opción');
    }
  };

  const retryLast = () => {
    const lastMessage = lastMessageRef.current[agent];
    if (lastMessage) void sendMessage(lastMessage);
  };

  const headerAction = async (action: string) => {
    if (action === 'human') {
      handleIntent(agent === 'support' ? 'support.handoff' : 'sales.handoff', 'Quiero hablar con una persona');
      return;
    }
    const summary = messages
      .filter((message) => message.author !== 'system')
      .map((message) => `${message.authorLabel}: ${message.content}`)
      .join('\n\n');
    if (action === 'download') {
      const url = URL.createObjectURL(new Blob([summary], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `resumen-${agent}-demostracion.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Resumen descargado.');
    } else if (action === 'share') {
      if (navigator.share) {
        await navigator.share({ title: 'Resumen de conversación HACEB', text: summary });
      } else {
        await navigator.clipboard.writeText(summary);
        showToast('Resumen copiado para compartir.');
      }
    }
  };

  const comparisonData = useMemo(
    () =>
      comparisonProducts.every((product) => COMPARISON_PRODUCT_IDS.includes(product.id))
        ? MOCK_PRODUCT_COMPARISON
        : undefined,
    [comparisonProducts],
  );
  const conversationText = messages.map((message) => message.content).join(' ').toLocaleLowerCase('es-CO');
  const hasIdentifiedProduct = /(nevera|lavadora|estufa|calentador|aire acondicionado)/.test(
    conversationText,
  );
  const hasDiagnostic = messages.some((message) =>
    message.blocks?.some((block) => block.type === 'diagnostic'),
  );
  const attachmentCount = messages.reduce(
    (total, message) => total + (message.attachments?.length ?? 0),
    0,
  );
  const salesCategory = conversationText.includes('nevera')
    ? 'Nevera'
    : conversationText.includes('lavadora')
      ? 'Lavadora'
      : conversationText.includes('estufa')
        ? 'Estufa'
        : conversationText.includes('calentador')
          ? 'Calentador'
          : conversationText.includes('aire')
            ? 'Aire acondicionado'
            : 'Por definir';

  return (
    <div className={`assistant-workspace assistant-workspace--${agent}`}>
      <div className="assistant-workspace__sidebar">
        <AppSidebar
          agent={agent}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onAgentChange={switchAgent}
          onSelectConversation={selectConversation}
          onNewConversation={newConversation}
        />
      </div>

      <main className="chat-column" id="main-content">
        <ChatHeader
          agent={agent}
          status={currentStatus}
          onAgentChange={switchAgent}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenContext={() => setContextOpen(true)}
          onClear={() => setClearOpen(true)}
          onAction={(action) => void headerAction(action)}
        />
        <MessageList
          agent={agent}
          messages={messages}
          quickActions={MOCK_AGENTS[agent].quickActions}
          isLoading={loadingByAgent[agent]}
          comparisonIds={comparisonProducts.map((product) => product.id)}
          onQuickAction={(action) => void sendMessage(action)}
          onCompare={toggleComparison}
          onSave={toggleSavedProduct}
          onIntent={handleIntent}
          onToast={showToast}
          onRetry={retryLast}
        />
        <MessageComposer
          agent={agent}
          isLoading={loadingByAgent[agent]}
          offline={!online}
          onSend={(message, attachments) => void sendMessage(message, attachments)}
          onMicrophone={() => showToast('El micrófono estará disponible en una siguiente versión.', 'info')}
        />
      </main>

      <div className="assistant-workspace__context">
        <ContextPanel
          agent={agent}
          comparisonProducts={comparisonProducts}
          savedProducts={savedProducts}
          onOpenComparison={() => setComparisonOpen(true)}
          onRemoveComparison={toggleComparison}
          onRequestTechnician={() => handleIntent('support.request-technician')}
          hasActivity={hasIdentifiedProduct}
          attachmentCount={attachmentCount}
          hasDiagnostic={hasDiagnostic}
          salesCategory={salesCategory}
          onEditSalesNeeds={() => void sendMessage('Quiero ajustar las necesidades de mi búsqueda')}
          onEditProduct={() => void sendMessage('Quiero corregir la información de mi producto')}
          onOpenManual={() => void sendMessage('Quiero consultar el manual de mi producto')}
        />
      </div>

      <Sheet open={historyOpen} title="Mis conversaciones" onClose={() => setHistoryOpen(false)} placement="left">
        <AppSidebar
          mobile
          agent={agent}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onAgentChange={switchAgent}
          onSelectConversation={selectConversation}
          onNewConversation={newConversation}
        />
      </Sheet>

      <Sheet open={contextOpen} title={agent === 'sales' ? 'Contexto de tu búsqueda' : 'Contexto de tu caso'} onClose={() => setContextOpen(false)} placement={contextPlacement}>
        <ContextPanel
          mobile
          agent={agent}
          comparisonProducts={comparisonProducts}
          savedProducts={savedProducts}
          onOpenComparison={() => {
            setContextOpen(false);
            setComparisonOpen(true);
          }}
          onRemoveComparison={toggleComparison}
          onRequestTechnician={() => handleIntent('support.request-technician')}
          hasActivity={hasIdentifiedProduct}
          attachmentCount={attachmentCount}
          hasDiagnostic={hasDiagnostic}
          salesCategory={salesCategory}
          onEditSalesNeeds={() => void sendMessage('Quiero ajustar las necesidades de mi búsqueda')}
          onEditProduct={() => void sendMessage('Quiero corregir la información de mi producto')}
          onOpenManual={() => void sendMessage('Quiero consultar el manual de mi producto')}
        />
      </Sheet>

      <Modal
        open={comparisonOpen}
        title="Comparar productos"
        description="Revisa las diferencias principales de hasta tres opciones."
        onClose={() => setComparisonOpen(false)}
        size="large"
      >
        <ProductComparison
          products={comparisonProducts}
          comparison={comparisonData}
          onRemove={(productId) => {
            const product = comparisonProducts.find((item) => item.id === productId);
            if (product) toggleComparison(product);
          }}
        />
      </Modal>

      <Modal
        open={clearOpen}
        title="¿Limpiar esta conversación?"
        description="Se quitarán los mensajes y el contexto de este agente. La conversación del otro agente no cambiará."
        onClose={() => setClearOpen(false)}
        size="small"
      >
        <div className="confirm-clear">
          <span aria-hidden="true">
            <AlertTriangle size={24} />
          </span>
          <p>Esta acción solo afecta la conversación actual y no elimina tu historial de demostración.</p>
          <div>
            <Button variant="secondary" onClick={() => setClearOpen(false)}>
              Conservar
            </Button>
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={clearConversation}>
              Limpiar
            </Button>
          </div>
        </div>
      </Modal>

      <Toast
        visible={Boolean(toast)}
        message={toast?.message ?? ''}
        tone={toast?.tone ?? 'success'}
        onDismiss={() => setToast(null)}
      />

      {comparisonProducts.length >= 2 && !comparisonOpen && (
        <button className="floating-comparison" type="button" onClick={() => setComparisonOpen(true)}>
          <GitCompareArrows size={18} aria-hidden="true" />
          Comparar {comparisonProducts.length}
        </button>
      )}
    </div>
  );
}
