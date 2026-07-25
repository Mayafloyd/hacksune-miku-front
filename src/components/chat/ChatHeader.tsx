import {
  Download,
  Ellipsis,
  Headphones,
  Menu,
  PanelRightOpen,
  Share2,
  ShoppingBag,
  Trash2,
  UserRoundSearch,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AgentAvailability, AgentType } from '../../types/agent';
import { AgentSwitcher } from './AgentSwitcher';

interface ChatHeaderProps {
  readonly agent: AgentType;
  readonly status: AgentAvailability;
  readonly onAgentChange: (agent: AgentType) => void;
  readonly onOpenHistory: () => void;
  readonly onOpenContext: () => void;
  readonly onClear: () => void;
  readonly onAction: (action: string) => void;
}

const statusText: Record<AgentAvailability, string> = {
  available: 'Disponible',
  thinking: 'Analizando tu solicitud',
  consulting: 'Consultando información',
  offline: 'Sin conexión',
  error: 'No disponible',
};

export function ChatHeader({
  agent,
  status,
  onAgentChange,
  onOpenHistory,
  onOpenContext,
  onClear,
  onAction,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const AgentIcon = agent === 'sales' ? ShoppingBag : Headphones;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [menuOpen]);

  const action = (value: string) => {
    setMenuOpen(false);
    if (value === 'clear') onClear();
    else onAction(value);
  };

  return (
    <header className="chat-header">
      <button className="icon-button chat-header__mobile-action" type="button" onClick={onOpenHistory} aria-label="Abrir conversaciones">
        <Menu size={19} aria-hidden="true" />
      </button>

      <div className="chat-header__identity">
        <span className={`agent-avatar agent-avatar--${agent}`} aria-hidden="true">
          <AgentIcon size={18} />
          <i />
        </span>
        <div>
          <h1>{agent === 'sales' ? 'Asesor de ventas' : 'Experto técnico'}</h1>
          <span className={`agent-status agent-status--${status}`}>
            <i />
            {statusText[status]}
          </span>
        </div>
      </div>

      <div className="chat-header__switcher">
        <AgentSwitcher activeAgent={agent} onChange={onAgentChange} compact />
      </div>

      <div className="chat-header__actions">
        <button
          className="context-trigger"
          type="button"
          onClick={onOpenContext}
          aria-label="Abrir contexto de la conversación"
        >
          <PanelRightOpen size={18} aria-hidden="true" />
          <span>Contexto</span>
        </button>
        <div className="chat-menu" ref={menuRef}>
          <button
            className="icon-button"
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Opciones de conversación"
          >
            {menuOpen ? <X size={18} /> : <Ellipsis size={20} />}
          </button>
          {menuOpen && (
            <div className="chat-menu__popover" role="menu">
              <button role="menuitem" type="button" onClick={() => action('download')}>
                <Download size={16} aria-hidden="true" />
                Descargar resumen
              </button>
              <button role="menuitem" type="button" onClick={() => action('share')}>
                <Share2 size={16} aria-hidden="true" />
                Compartir
              </button>
              <button role="menuitem" type="button" onClick={() => action('human')}>
                <UserRoundSearch size={16} aria-hidden="true" />
                Solicitar asesor humano
              </button>
              <span role="separator" />
              <button className="is-danger" role="menuitem" type="button" onClick={() => action('clear')}>
                <Trash2 size={16} aria-hidden="true" />
                Limpiar conversación
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
