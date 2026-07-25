import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Contact,
  Home,
  MapPin,
  Package,
  Wrench,
} from 'lucide-react';
import { useId, useMemo, useState, type SyntheticEvent } from 'react';
import type { ServiceAppointment } from '../../types/support';
import { Button } from '../common/Button';

interface ServiceSchedulerProps {
  readonly onComplete?: (appointment: ServiceAppointment) => void;
}

const steps = [
  { label: 'Servicio', icon: Wrench },
  { label: 'Producto', icon: Package },
  { label: 'Dirección', icon: Home },
  { label: 'Fecha', icon: CalendarDays },
  { label: 'Contacto', icon: Contact },
  { label: 'Resumen', icon: Check },
] as const;

interface SchedulerForm {
  readonly serviceType: string;
  readonly product: string;
  readonly city: string;
  readonly address: string;
  readonly date: string;
  readonly slot: string;
  readonly name: string;
  readonly phone: string;
}

type SchedulerErrors = Partial<Record<keyof SchedulerForm, string>>;

const identifiedProducts = [
  'Nevera demo · REF-DEMO-420',
  'Lavadora demo · LAV-DEMO-18',
] as const;

const availableSlots = [
  '8:00 a. m. – 12:00 m.',
  '1:00 p. m. – 5:00 p. m.',
] as const;

const unidentifiedProductOption = 'Registrar otro producto';

const initialForm: SchedulerForm = {
  serviceType: 'Diagnóstico en domicilio',
  product: 'Nevera demo · REF-DEMO-420',
  city: 'Medellín',
  address: '',
  date: '2026-07-29',
  slot: '8:00 a. m. – 12:00 m.',
  name: '',
  phone: '',
};

function isIdentifiedProduct(product: string) {
  return identifiedProducts.some((identifiedProduct) => identifiedProduct === product);
}

function isValidCalendarDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
}

function getStepErrors(step: number, form: SchedulerForm): SchedulerErrors {
  const nextErrors: SchedulerErrors = {};

  if (step === 1 && !isIdentifiedProduct(form.product)) {
    nextErrors.product = 'Selecciona un producto identificado. Para registrar otro, primero identifica el equipo.';
  }

  if (step === 2 && form.address.trim().length < 5) {
    nextErrors.address = 'Escribe una dirección válida.';
  }

  if (step === 3) {
    if (!form.date) {
      nextErrors.date = 'Selecciona una fecha para la visita.';
    } else if (!isValidCalendarDate(form.date)) {
      nextErrors.date = 'Revisa la fecha de la visita.';
    }

    if (!availableSlots.some((slot) => slot === form.slot)) {
      nextErrors.slot = 'Selecciona una franja horaria disponible.';
    }
  }

  if (step === 4 && form.name.trim().length < 2) {
    nextErrors.name = 'Escribe el nombre de contacto.';
  }

  if (step === 4 && form.phone.replace(/\D/g, '').length < 7) {
    nextErrors.phone = 'Revisa el número de contacto.';
  }

  return nextErrors;
}

export function ServiceScheduler({ onComplete }: ServiceSchedulerProps) {
  const schedulerId = useId();
  const titleId = `${schedulerId}-title`;
  const serviceTypeName = `${schedulerId}-service-type`;
  const productId = `${schedulerId}-product`;
  const productDescriptionId = `${schedulerId}-product-description`;
  const productErrorId = `${schedulerId}-product-error`;
  const cityId = `${schedulerId}-city`;
  const addressId = `${schedulerId}-address`;
  const addressErrorId = `${schedulerId}-address-error`;
  const dateId = `${schedulerId}-date`;
  const dateErrorId = `${schedulerId}-date-error`;
  const slotId = `${schedulerId}-slot`;
  const slotErrorId = `${schedulerId}-slot-error`;
  const availabilityId = `${schedulerId}-availability`;
  const nameId = `${schedulerId}-name`;
  const nameErrorId = `${schedulerId}-name-error`;
  const phoneId = `${schedulerId}-phone`;
  const phoneErrorId = `${schedulerId}-phone-error`;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<SchedulerErrors>({});

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const validateStep = () => {
    const stepErrors = getStepErrors(step, form);
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const validateForm = () => {
    const formErrors: SchedulerErrors = {};
    let firstInvalidStep: number | undefined;

    for (const stepToValidate of [1, 2, 3, 4] as const) {
      const stepErrors = getStepErrors(stepToValidate, form);
      if (firstInvalidStep === undefined && Object.keys(stepErrors).length > 0) {
        firstInvalidStep = stepToValidate;
      }
      Object.assign(formErrors, stepErrors);
    }

    setErrors(formErrors);
    if (firstInvalidStep !== undefined) {
      setStep(firstInvalidStep);
      return false;
    }

    return true;
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < steps.length - 1) {
      next();
      return;
    }
    if (!validateForm()) return;

    onComplete?.({
      id: 'demo-appointment-live',
      requestId: 'demo-request-live',
      provisionalNumber: 'SOL-DEMO-NUEVA',
      serviceType: form.serviceType,
      productLabel: form.product.split(' · ')[0] ?? form.product,
      model: form.product.split(' · ')[1] ?? 'Por confirmar',
      city: form.city,
      addressMasked: form.address.replace(/\d(?=\d{2})/g, '•') || 'Dirección protegida',
      date: form.date,
      timeSlot: form.slot,
      contactName: form.name,
      contactPhoneMasked: form.phone.replace(/\d(?=\d{3})/g, '•'),
      availability: 'confirmed',
      statusLabel: 'Cita confirmada (demostración)',
      calendarTitle: 'Visita técnica — referencia provisional',
      demo: {
        isDemonstration: true,
        notice: 'Dato demostrativo. Sustituir por información oficial.',
      },
    });
  };

  return (
    <form className="scheduler" onSubmit={submit} noValidate aria-labelledby={titleId}>
      <header className="scheduler__header">
        <div>
          <span className="eyebrow">Agendamiento guiado · demostración</span>
          <h3 id={titleId}>Preparemos tu visita técnica</h3>
        </div>
        <span>
          Paso {step + 1} de {steps.length}
        </span>
      </header>
      <div className="scheduler__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <ol className="scheduler__steps" aria-label="Progreso del agendamiento">
        {steps.map(({ label, icon: Icon }, index) => (
          <li key={label} className={index === step ? 'is-active' : index < step ? 'is-complete' : ''}>
            <button type="button" onClick={() => index <= step && setStep(index)} aria-current={index === step ? 'step' : undefined}>
              <span>{index < step ? <Check size={15} /> : <Icon size={15} />}</span>
              <small>{label}</small>
            </button>
          </li>
        ))}
      </ol>

      <div className="scheduler__panel">
        {step === 0 && (
          <fieldset>
            <legend>¿Qué tipo de ayuda necesitas?</legend>
            <label className="option-card">
              <input
                type="radio"
                name={serviceTypeName}
                checked={form.serviceType === 'Diagnóstico en domicilio'}
                onChange={() => update('serviceType', 'Diagnóstico en domicilio')}
              />
              <span>
                <Wrench size={20} />
                <strong>Diagnóstico en domicilio</strong>
                <small>Una persona certificada revisa el funcionamiento.</small>
              </span>
            </label>
            <label className="option-card">
              <input
                type="radio"
                name={serviceTypeName}
                checked={form.serviceType === 'Mantenimiento preventivo'}
                onChange={() => update('serviceType', 'Mantenimiento preventivo')}
              />
              <span>
                <Clock3 size={20} />
                <strong>Mantenimiento preventivo</strong>
                <small>Revisión planificada para cuidar tu producto.</small>
              </span>
            </label>
          </fieldset>
        )}

        {step === 1 && (
          <div className="field-stack">
            <label htmlFor={productId}>Producto</label>
            <select
              id={productId}
              value={form.product}
              onChange={(e) => update('product', e.target.value)}
              aria-invalid={Boolean(errors.product)}
              aria-describedby={
                errors.product ? `${productDescriptionId} ${productErrorId}` : productDescriptionId
              }
            >
              {identifiedProducts.map((product) => (
                <option key={product}>{product}</option>
              ))}
              <option>{unidentifiedProductOption}</option>
            </select>
            <p id={productDescriptionId}>
              La referencia es demostrativa y deberá validarse con la placa del equipo.
            </p>
            {errors.product && (
              <span className="field-error" id={productErrorId} role="alert">
                {errors.product}
              </span>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            <div className="field-stack">
              <label htmlFor={cityId}>Ciudad</label>
              <select id={cityId} value={form.city} onChange={(e) => update('city', e.target.value)}>
                <option>Medellín</option>
                <option>Bogotá</option>
                <option>Cali</option>
                <option>Barranquilla</option>
              </select>
            </div>
            <div className="field-stack form-grid__wide">
              <label htmlFor={addressId}>Dirección</label>
              <div className="input-with-icon">
                <MapPin size={17} aria-hidden="true" />
                <input
                  id={addressId}
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="Ej. Carrera 00 # 00-00"
                  aria-invalid={Boolean(errors.address)}
                  aria-describedby={errors.address ? addressErrorId : undefined}
                />
              </div>
              {errors.address && (
                <span className="field-error" id={addressErrorId} role="alert">
                  {errors.address}
                </span>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="form-grid">
            <div className="field-stack">
              <label htmlFor={dateId}>Fecha disponible</label>
              <input
                id={dateId}
                type="date"
                value={form.date}
                onChange={(e) => update('date', e.target.value)}
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? `${availabilityId} ${dateErrorId}` : availabilityId}
                required
              />
              {errors.date && (
                <span className="field-error" id={dateErrorId} role="alert">
                  {errors.date}
                </span>
              )}
            </div>
            <div className="field-stack">
              <label htmlFor={slotId}>Franja horaria</label>
              <select
                id={slotId}
                value={form.slot}
                onChange={(e) => update('slot', e.target.value)}
                aria-invalid={Boolean(errors.slot)}
                aria-describedby={errors.slot ? `${availabilityId} ${slotErrorId}` : availabilityId}
                required
              >
                {availableSlots.map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
                <option disabled>Franja no disponible · 5:00 p. m.</option>
              </select>
              {errors.slot && (
                <span className="field-error" id={slotErrorId} role="alert">
                  {errors.slot}
                </span>
              )}
            </div>
            <p className="form-grid__wide scheduler__availability" id={availabilityId}>
              <Clock3 size={16} aria-hidden="true" />
              Disponibilidad simulada; la API oficial debe confirmar la franja.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="form-grid">
            <div className="field-stack">
              <label htmlFor={nameId}>Nombre de contacto</label>
              <input
                id={nameId}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Tu nombre"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? nameErrorId : undefined}
              />
              {errors.name && (
                <span className="field-error" id={nameErrorId} role="alert">
                  {errors.name}
                </span>
              )}
            </div>
            <div className="field-stack">
              <label htmlFor={phoneId}>Celular</label>
              <input
                id={phoneId}
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="300 000 0000"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? phoneErrorId : undefined}
              />
              {errors.phone && (
                <span className="field-error" id={phoneErrorId} role="alert">
                  {errors.phone}
                </span>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="scheduler__summary">
            <div>
              <span>Servicio</span>
              <strong>{form.serviceType}</strong>
            </div>
            <div>
              <span>Producto</span>
              <strong>{form.product}</strong>
            </div>
            <div>
              <span>Visita</span>
              <strong>{form.date} · {form.slot}</strong>
            </div>
            <div>
              <span>Lugar</span>
              <strong>{form.address}, {form.city}</strong>
            </div>
            <p>Al confirmar aceptas que estos datos se usen para gestionar esta solicitud demostrativa.</p>
          </div>
        )}
      </div>

      <footer className="scheduler__footer">
        <Button
          variant="ghost"
          icon={<ArrowLeft size={16} />}
          onClick={() => setStep((value) => Math.max(0, value - 1))}
          disabled={step === 0}
        >
          Atrás
        </Button>
        <Button type="submit" variant="primary" trailingIcon={step === steps.length - 1 ? <Check size={16} /> : <ArrowRight size={16} />}>
          {step === steps.length - 1 ? 'Confirmar solicitud' : 'Continuar'}
        </Button>
      </footer>
    </form>
  );
}
