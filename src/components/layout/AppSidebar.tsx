import {
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Headphones,
  Home,
  MessageSquarePlus,
  Search,
  ShoppingBag,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AgentType } from '../../types/agent';
import type { Conversation, ConversationGroup } from '../../types/chat';
import { AgentSwitcher } from '../chat/AgentSwitcher';

interface AppSidebarProps {
  readonly agent: AgentType;
  readonly conversations: readonly Conversation[];
  readonly activeConversationId?: string | undefined;
  readonly onAgentChange: (agent: AgentType) => void;
  readonly onSelectConversation: (conversation: Conversation) => void;
  readonly onNewConversation: () => void;
  readonly mobile?: boolean;
}

const groups: readonly { key: ConversationGroup; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'this-week', label: 'Esta semana' },
  { key: 'previous', label: 'Anteriores' },
];

export function AppSidebar({
  agent,
  conversations,
  activeConversationId,
  onAgentChange,
  onSelectConversation,
  onNewConversation,
  mobile = false,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-CO');
    return conversations.filter((conversation) => !normalized || conversation.title.toLocaleLowerCase('es-CO').includes(normalized));
  }, [conversations, query]);

  return (
    <aside className={`app-sidebar ${collapsed && !mobile ? 'is-collapsed' : ''} ${mobile ? 'is-mobile' : ''}`}>
      <div className="app-sidebar__brand">
        <a href="/" aria-label="Volver al inicio">
          <span className="brand-wordmark">HACEB</span>
          {!collapsed && <span>Asistente <small>provisional</small></span>}
        </a>
        {!mobile && (
          <button
            className="app-sidebar__collapse"
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        )}
      </div>

      <a className="sidebar-home" href="/">
        <Home size={17} aria-hidden="true" />
        {!collapsed && <span>Inicio</span>}
      </a>

      <button className="new-conversation" type="button" onClick={onNewConversation}>
        <MessageSquarePlus size={18} aria-hidden="true" />
        {!collapsed && <span>Nueva conversación</span>}
      </button>

      {!collapsed && (
        <>
          <AgentSwitcher activeAgent={agent} onChange={onAgentChange} />
          <label className="conversation-search">
            <span className="sr-only">Buscar conversaciones</span>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar conversaciones"
            />
          </label>
          <div className="conversation-history">
            {groups.map((group) => {
              const items = filtered.filter((conversation) => conversation.group === group.key);
              if (items.length === 0) return null;
              return (
                <section key={group.key}>
                  <h2>{group.label}</h2>
                  <ul>
                    {items.map((conversation) => {
                      const Icon = conversation.agent === 'sales' ? ShoppingBag : Headphones;
                      return (
                        <li key={conversation.id}>
                          <button
                            type="button"
                            className={activeConversationId === conversation.id ? 'is-active' : ''}
                            onClick={() => onSelectConversation(conversation)}
                          >
                            <span className={`history-icon history-icon--${conversation.agent}`}>
                              <Icon size={14} aria-hidden="true" />
                            </span>
                            <span>
                              <strong>{conversation.title}</strong>
                              <small>{conversation.agent === 'sales' ? 'Ventas' : 'Soporte'}</small>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {filtered.length === 0 && <p className="conversation-history__empty">No encontramos conversaciones con ese nombre.</p>}
          </div>
        </>
      )}

      <button className="sidebar-profile" type="button">
        <CircleUserRound size={22} aria-hidden="true" />
        {!collapsed && (
          <span>
            <strong>Invitado</strong>
            <small>Sesión local · demo</small>
          </span>
        )}
      </button>
    </aside>
  );
}
