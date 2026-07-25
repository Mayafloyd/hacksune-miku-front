import { Headphones, ShoppingBag } from 'lucide-react';
import type { AgentType } from '../../types/agent';

interface AgentSwitcherProps {
  readonly activeAgent: AgentType;
  readonly onChange: (agent: AgentType) => void;
  readonly compact?: boolean;
}

export function AgentSwitcher({ activeAgent, onChange, compact = false }: AgentSwitcherProps) {
  return (
    <div className={`agent-switcher ${compact ? 'agent-switcher--compact' : ''}`} role="group" aria-label="Cambiar agente">
      <span
        className={`agent-switcher__indicator agent-switcher__indicator--${activeAgent}`}
        aria-hidden="true"
      />
      <button
        type="button"
        className={activeAgent === 'sales' ? 'is-active' : ''}
        onClick={() => onChange('sales')}
        aria-pressed={activeAgent === 'sales'}
      >
        <ShoppingBag size={compact ? 15 : 17} aria-hidden="true" />
        <span>Ventas</span>
      </button>
      <button
        type="button"
        className={activeAgent === 'support' ? 'is-active' : ''}
        onClick={() => onChange('support')}
        aria-pressed={activeAgent === 'support'}
      >
        <Headphones size={compact ? 15 : 17} aria-hidden="true" />
        <span>Soporte</span>
      </button>
    </div>
  );
}
