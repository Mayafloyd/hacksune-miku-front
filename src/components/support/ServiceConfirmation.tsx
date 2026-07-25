import { CalendarPlus, Check, MapPin, Package, RefreshCw, TicketCheck } from 'lucide-react';
import type { ServiceAppointment } from '../../types/support';
import { Button } from '../common/Button';

interface ServiceConfirmationProps {
  readonly appointment: ServiceAppointment;
  readonly onManage?: () => void;
}

export function ServiceConfirmation({ appointment, onManage }: ServiceConfirmationProps) {
  const date = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${appointment.date}T12:00:00`));

  const downloadCalendar = () => {
    const dateToken = appointment.date.replaceAll('-', '');
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `UID:${appointment.id}@demo.haceb`,
      `DTSTART;VALUE=DATE:${dateToken}`,
      `DTEND;VALUE=DATE:${dateToken}`,
      `SUMMARY:${appointment.calendarTitle}`,
      'DESCRIPTION:Agendamiento provisional de demostración. Confirmar en el sistema oficial.',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'visita-tecnica-provisional.ics';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="service-confirmation" aria-labelledby={`appointment-${appointment.id}`}>
      <div className="service-confirmation__check" aria-hidden="true">
        <Check size={28} />
      </div>
      <span className="eyebrow">Solicitud provisional</span>
      <h3 id={`appointment-${appointment.id}`}>Tu visita quedó preparada</h3>
      <p>
        Guardamos esta demostración. En una integración real, recibirías la confirmación por el canal elegido.
      </p>
      <span className="service-confirmation__number">
        <TicketCheck size={17} aria-hidden="true" />
        {appointment.provisionalNumber}
      </span>
      <dl>
        <div>
          <dt>
            <CalendarPlus size={16} aria-hidden="true" />
            Fecha y franja
          </dt>
          <dd>
            {date} · {appointment.timeSlot}
          </dd>
        </div>
        <div>
          <dt>
            <MapPin size={16} aria-hidden="true" />
            Dirección
          </dt>
          <dd>
            {appointment.addressMasked}, {appointment.city}
          </dd>
        </div>
        <div>
          <dt>
            <Package size={16} aria-hidden="true" />
            Producto
          </dt>
          <dd>
            {appointment.productLabel} · {appointment.model}
          </dd>
        </div>
      </dl>
      <div className="service-confirmation__actions">
        <Button variant="dark" icon={<CalendarPlus size={17} />} onClick={downloadCalendar}>
          Agregar al calendario
        </Button>
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={onManage}>
          Consultar o reprogramar
        </Button>
      </div>
      <span className="dev-label">Confirmación demostrativa</span>
    </section>
  );
}
