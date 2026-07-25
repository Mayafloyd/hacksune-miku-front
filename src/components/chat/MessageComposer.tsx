import { ArrowUp, Mic, Paperclip, ShieldCheck, WifiOff, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import type { AgentType } from '../../types/agent';
import type { ChatAttachment } from '../../types/chat';
import { AttachmentPreview } from './AttachmentPreview';

interface MessageComposerProps {
  readonly agent: AgentType;
  readonly isLoading: boolean;
  readonly offline?: boolean;
  readonly onSend: (message: string, attachments: readonly ChatAttachment[]) => void;
  readonly onMicrophone?: () => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function MessageComposer({
  agent,
  isLoading,
  offline = false,
  onSend,
  onMicrophone,
}: MessageComposerProps) {
  const [drafts, setDrafts] = useState<Record<AgentType, string>>({ sales: '', support: '' });
  const [attachmentsByAgent, setAttachmentsByAgent] = useState<
    Record<AgentType, readonly ChatAttachment[]>
  >({ sales: [], support: [] });
  const [isRecordingMock, setIsRecordingMock] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentUrlsRef = useRef<Set<string>>(new Set());
  const value = drafts[agent];
  const attachments = attachmentsByAgent[agent];

  const setValue = (nextValue: string) => {
    setDrafts((current) => ({ ...current, [agent]: nextValue }));
  };

  const setAttachments = (
    update:
      | readonly ChatAttachment[]
      | ((current: readonly ChatAttachment[]) => readonly ChatAttachment[]),
  ) => {
    setAttachmentsByAgent((current) => ({
      ...current,
      [agent]:
        typeof update === 'function'
          ? update(current[agent])
          : update,
    }));
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = value ? `${Math.min(textarea.scrollHeight, 144)}px` : 'auto';
  }, [agent, value]);

  useEffect(
    () => () => {
      attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      attachmentUrlsRef.current.clear();
    },
    [],
  );

  const resize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  };

  const submit = () => {
    if (isLoading || offline || (!value.trim() && attachments.length === 0)) return;
    const validAttachments = attachments.filter((item) => item.uploadStatus === 'ready');
    onSend(value.trim() || 'Adjunto un archivo para revisar.', validAttachments);
    setValue('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const targetAgent = agent;
    const next = files.map<ChatAttachment>((file, index) => {
      const validType = ALLOWED_TYPES.includes(file.type);
      const validSize = file.size <= MAX_FILE_BYTES;
      const valid = validType && validSize;
      const errorMessage = !validType
        ? 'Formato no permitido. Usa JPG, PNG, WEBP o PDF.'
        : !validSize
          ? 'El archivo supera el límite de 10 MB.'
          : null;
      const previewUrl = valid && file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      if (previewUrl) attachmentUrlsRef.current.add(previewUrl);
      return {
        id: `attachment-${Date.now()}-${index}`,
        name: file.name,
        mediaType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        uploadStatus: valid ? 'uploading' : 'invalid',
        ...(previewUrl ? { previewUrl } : {}),
        ...(errorMessage ? { errorMessage } : {}),
      };
    });
    setAttachmentsByAgent((current) => ({
      ...current,
      [targetAgent]: [...current[targetAgent], ...next].slice(0, 4),
    }));
    const readyIds = next
      .filter((attachment) => attachment.uploadStatus === 'uploading')
      .map((attachment) => attachment.id);
    if (readyIds.length > 0) {
      window.setTimeout(() => {
        setAttachmentsByAgent((current) => ({
          ...current,
          [targetAgent]: current[targetAgent].map((attachment) =>
            readyIds.includes(attachment.id)
              ? { ...attachment, uploadStatus: 'ready' }
              : attachment,
          ),
        }));
      }, 520);
    }
    event.target.value = '';
  };

  const toggleMic = () => {
    setIsRecordingMock((value) => !value);
    onMicrophone?.();
  };

  return (
    <div className="composer-shell">
      {offline && (
        <div className="composer-offline" role="status">
          <WifiOff size={16} aria-hidden="true" />
          Sin conexión. Tus mensajes se conservarán en este dispositivo.
        </div>
      )}
      {attachments.length > 0 && (
        <div className="composer-attachments" aria-label="Archivos seleccionados">
          {attachments.map((attachment) => (
            <AttachmentPreview
              key={attachment.id}
              attachment={attachment}
              onRemove={(id) => {
                const removed = attachments.find((item) => item.id === id);
                if (removed?.previewUrl) {
                  URL.revokeObjectURL(removed.previewUrl);
                  attachmentUrlsRef.current.delete(removed.previewUrl);
                }
                setAttachments((items) => items.filter((item) => item.id !== id));
              }}
            />
          ))}
          <button className="composer-attachments__clear" type="button" onClick={() => setAttachments([])}>
            <X size={14} aria-hidden="true" />
            Quitar todos
          </button>
        </div>
      )}
      <div className={`message-composer message-composer--${agent} ${isLoading ? 'is-loading' : ''}`}>
        <div className="message-composer__agent" aria-hidden="true">
          <span className={`agent-avatar agent-avatar--${agent}`}>
            <i />
          </span>
          <span>{agent === 'sales' ? 'Ventas' : 'Soporte'}</span>
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={1600}
          placeholder={
            agent === 'sales'
              ? 'Cuéntame qué producto estás buscando…'
              : 'Describe qué está sucediendo con tu producto…'
          }
          aria-label="Mensaje"
          disabled={offline}
        />
        <div className="message-composer__actions">
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            multiple
            onChange={addFiles}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Adjuntar fotografía o documento"
            title="Adjuntar archivo"
          >
            <Paperclip size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={isRecordingMock ? 'is-recording' : ''}
            onClick={toggleMic}
            aria-label={isRecordingMock ? 'Detener micrófono de demostración' : 'Usar micrófono, demostración'}
            aria-pressed={isRecordingMock}
            title="Micrófono (demostración)"
          >
            <Mic size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="message-composer__send"
            onClick={submit}
            disabled={isLoading || offline || (!value.trim() && attachments.filter((item) => item.uploadStatus === 'ready').length === 0)}
            aria-label="Enviar mensaje"
          >
            <ArrowUp size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="composer-privacy">
        <ShieldCheck size={13} aria-hidden="true" />
        No compartas contraseñas ni datos financieros. Verifica la información crítica antes de actuar.
        <span>Enter para enviar · Shift + Enter para una nueva línea</span>
      </p>
    </div>
  );
}
