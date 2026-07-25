import { Check, CheckCircle2, ChevronRight, Circle, HardHat, ShieldAlert, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DiagnosticCase, DiagnosticChoice } from '../../types/support';
import { Button } from '../common/Button';

interface DiagnosticStepsProps {
  readonly diagnostic: DiagnosticCase;
  readonly onChoice?: (choice: DiagnosticChoice['id'], stepId: string) => void;
  readonly onEscalate?: () => void;
}

export function DiagnosticSteps({ diagnostic, onChoice, onEscalate }: DiagnosticStepsProps) {
  const firstCurrent = Math.max(
    0,
    diagnostic.steps.findIndex((step) => step.status === 'current'),
  );
  const [activeIndex, setActiveIndex] = useState(firstCurrent);
  const [completed, setCompleted] = useState<readonly number[]>(
    diagnostic.steps
      .map((step, index) => (step.status === 'completed' ? index : -1))
      .filter((index) => index >= 0),
  );
  const [outcome, setOutcome] = useState<'active' | 'resolved' | 'inconclusive' | 'escalated'>('active');
  const activeStep = diagnostic.steps[activeIndex];
  const progress = useMemo(
    () =>
      outcome === 'resolved' || outcome === 'escalated'
        ? 100
        : Math.round((completed.length / diagnostic.steps.length) * 100),
    [completed.length, diagnostic.steps.length, outcome],
  );

  if (!activeStep) return null;

  const choose = (choice: DiagnosticChoice) => {
    onChoice?.(choice.id, activeStep.id);
    if (choice.id === 'worked') {
      setCompleted((items) => (items.includes(activeIndex) ? items : [...items, activeIndex]));
      setOutcome('resolved');
    }
    if (choice.id === 'continues' && activeIndex < diagnostic.steps.length - 1) {
      setCompleted((items) => (items.includes(activeIndex) ? items : [...items, activeIndex]));
      setActiveIndex((index) => index + 1);
    } else if (choice.id === 'continues') {
      setOutcome('escalated');
      onEscalate?.();
    }
    if (choice.id === 'cannot-check') {
      setOutcome('inconclusive');
      onEscalate?.();
    }
  };

  return (
    <section className="diagnostic" aria-labelledby={`diagnostic-${diagnostic.id}`}>
      <header className="diagnostic__header">
        <div className="diagnostic__heading">
          <span className="diagnostic__icon" aria-hidden="true">
            <Wrench size={21} />
          </span>
          <div>
            <span className="eyebrow">Diagnóstico guiado · demostración</span>
            <h3 id={`diagnostic-${diagnostic.id}`}>{diagnostic.symptom}</h3>
          </div>
        </div>
        <span className="diagnostic__progress-label">{progress}% revisado</span>
      </header>
      <div
        className="diagnostic__progress"
        role="progressbar"
        aria-label="Progreso del diagnóstico"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>

      <ol className="diagnostic__stepper">
        {diagnostic.steps.map((step, index) => {
          const isCompleted = completed.includes(index);
          const isActive = activeIndex === index;
          return (
            <li key={step.id} className={isActive ? 'is-active' : isCompleted ? 'is-complete' : ''}>
              <button type="button" onClick={() => setActiveIndex(index)} aria-current={isActive ? 'step' : undefined}>
                <span>{isCompleted ? <Check size={14} /> : <Circle size={11} fill="currentColor" />}</span>
                <small>Paso {step.order}</small>
                <strong>{step.title}</strong>
              </button>
            </li>
          );
        })}
      </ol>

      {outcome === 'active' ? (
        <div className="diagnostic__current" key={activeStep.id}>
        <span className="diagnostic__number">{String(activeStep.order).padStart(2, '0')}</span>
        <div>
          <h4>{activeStep.title}</h4>
          <p>{activeStep.instruction}</p>
          {activeStep.safetyNote && (
            <div className="diagnostic__safety">
              <ShieldAlert size={17} aria-hidden="true" />
              <span>{activeStep.safetyNote}</span>
            </div>
          )}
          <div className="diagnostic__choices">
            {activeStep.choices.map((choice) => (
              <Button
                key={choice.id}
                variant={choice.id === 'worked' ? 'primary' : 'secondary'}
                trailingIcon={<ChevronRight size={15} />}
                onClick={() => choose(choice)}
              >
                {choice.label}
              </Button>
            ))}
          </div>
        </div>
        </div>
      ) : (
        <div className={`diagnostic__outcome diagnostic__outcome--${outcome}`} role="status">
          <CheckCircle2 size={23} aria-hidden="true" />
          <div>
            <h4>{outcome === 'resolved' ? 'La verificación funcionó' : 'Terminamos las verificaciones seguras'}</h4>
            <p>
              {outcome === 'resolved'
                ? 'Marcamos este diagnóstico como resuelto. Si el síntoma regresa, suspende el uso y vuelve a pedir ayuda.'
                : 'No necesitas revisar nada interno. Continuaremos con acompañamiento profesional.'}
            </p>
          </div>
        </div>
      )}

      <button className="diagnostic__stop" type="button" onClick={onEscalate}>
        <HardHat size={17} aria-hidden="true" />
        Suspender diagnóstico y solicitar un técnico
      </button>
    </section>
  );
}
