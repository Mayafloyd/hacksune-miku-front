import {
  Banknote,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FileUp,
  GitCompareArrows,
  Headphones,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
  Wrench,
  X,
} from 'lucide-react';
import type { AgentType } from '../../types/agent';
import type { Product } from '../../types/product';
import { SalesRequirements } from '../sales/SalesRequirements';
import { ProductIdentificationCard } from '../support/ProductIdentificationCard';
import { MOCK_IDENTIFIED_PRODUCTS } from '../../data/mock-support';

interface ContextPanelProps {
  readonly agent: AgentType;
  readonly comparisonProducts: readonly Product[];
  readonly savedProducts?: readonly Product[];
  readonly onOpenComparison: () => void;
  readonly onRemoveComparison?: (product: Product) => void;
  readonly onRequestTechnician?: () => void;
  readonly hasActivity?: boolean;
  readonly attachmentCount?: number;
  readonly hasDiagnostic?: boolean;
  readonly salesCategory?: string;
  readonly onEditSalesNeeds?: () => void;
  readonly onEditProduct?: () => void;
  readonly onOpenManual?: () => void;
  readonly mobile?: boolean;
}

export function ContextPanel({
  agent,
  comparisonProducts,
  savedProducts = [],
  onOpenComparison,
  onRemoveComparison,
  onRequestTechnician,
  hasActivity = false,
  attachmentCount = 0,
  hasDiagnostic = false,
  salesCategory = 'Por definir',
  onEditSalesNeeds,
  onEditProduct,
  onOpenManual,
  mobile = false,
}: ContextPanelProps) {
  return (
    <aside className={`context-panel context-panel--${agent} ${mobile ? 'is-mobile' : ''}`}>
      <header className="context-panel__header">
        <div>
          <span className={`context-panel__agent context-panel__agent--${agent}`} aria-hidden="true">
            {agent === 'sales' ? <ShoppingBag size={17} /> : <Headphones size={17} />}
          </span>
          <div>
            <span className="eyebrow">Contexto vivo</span>
            <h2>{agent === 'sales' ? 'Tu búsqueda' : 'Tu caso técnico'}</h2>
          </div>
        </div>
        <span className="dev-label">Demo</span>
      </header>

      {agent === 'sales' ? (
        <>
          <SalesRequirements
            category={salesCategory}
            priorities={comparisonProducts.length > 0 ? ['Capacidad', 'Espacio'] : []}
            onEdit={onEditSalesNeeds}
          />
          <section className="context-section">
            <header>
              <span>
                <GitCompareArrows size={16} aria-hidden="true" />
                Comparación activa
              </span>
              <strong>{comparisonProducts.length}/3</strong>
            </header>
            {comparisonProducts.length === 0 ? (
              <p className="context-section__empty">Los productos que compares aparecerán aquí.</p>
            ) : (
              <ul className="context-products">
                {comparisonProducts.map((product) => (
                  <li key={product.id}>
                    <img src={product.image.src} alt="" width="48" height="40" />
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.capacity.label.replace(' (dato demostrativo)', '')}</small>
                    </span>
                    <button type="button" onClick={() => onRemoveComparison?.(product)} aria-label={`Quitar ${product.name}`}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="context-section__action"
              type="button"
              onClick={onOpenComparison}
              disabled={comparisonProducts.length < 2}
            >
              Abrir comparación
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </section>
          <section className="context-metrics">
            <div>
              <Bookmark size={16} aria-hidden="true" />
              <span>Guardados</span>
              <strong>{savedProducts.length}</strong>
            </div>
            <div>
              <Banknote size={16} aria-hidden="true" />
              <span>Presupuesto</span>
              <strong>Por definir</strong>
            </div>
          </section>
          <section className="context-recommendation">
            <span aria-hidden="true">
              <PackageCheck size={18} />
            </span>
            <div>
              <small>Recomendación actual</small>
              <strong>{comparisonProducts[0]?.name ?? 'Aún estamos conociendo tu necesidad'}</strong>
            </div>
          </section>
        </>
      ) : (
        <>
          {hasActivity ? (
            <ProductIdentificationCard
              product={MOCK_IDENTIFIED_PRODUCTS[0]}
              onEdit={onEditProduct}
              onOpenManual={onOpenManual}
            />
          ) : (
            <section className="context-empty-product">
              <span aria-hidden="true">
                <PackageCheck size={20} />
              </span>
              <div>
                <strong>Aún no identificamos tu producto</strong>
                <p>Escribe el tipo y la referencia, o adjunta una foto de la placa.</p>
              </div>
            </section>
          )}
          <section className="context-section support-progress">
            <header>
              <span>
                <Stethoscope size={16} aria-hidden="true" />
                Diagnóstico
              </span>
              <strong>{hasDiagnostic ? '2/4' : '0/4'}</strong>
            </header>
            <div
              className="support-progress__bar"
              aria-label={hasDiagnostic ? 'Diagnóstico al 50%' : 'Diagnóstico sin iniciar'}
            >
              <span style={{ width: hasDiagnostic ? '50%' : '0%' }} />
            </div>
            <ol>
              <li className={hasActivity ? 'is-complete' : ''}>
                <CheckCircle2 size={15} aria-hidden="true" />
                Producto identificado
              </li>
              <li className={hasDiagnostic ? 'is-active' : ''}>
                <Wrench size={15} aria-hidden="true" />
                Verificaciones seguras
              </li>
              <li>
                <CircleDashed size={15} aria-hidden="true" />
                Resultado
              </li>
            </ol>
          </section>
          <section className="context-metrics">
            <div>
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Garantía</span>
              <strong>{hasActivity ? 'Por verificar' : 'Sin consultar'}</strong>
            </div>
            <div>
              <FileUp size={16} aria-hidden="true" />
              <span>Adjuntos</span>
              <strong>{attachmentCount} {attachmentCount === 1 ? 'archivo' : 'archivos'}</strong>
            </div>
          </section>
          <button className="context-technician" type="button" onClick={onRequestTechnician}>
            <Wrench size={17} aria-hidden="true" />
            Solicitar técnico certificado
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </>
      )}
      <p className="context-panel__notice">
        Esta información cambia con la conversación y no sustituye una validación oficial.
      </p>
    </aside>
  );
}
