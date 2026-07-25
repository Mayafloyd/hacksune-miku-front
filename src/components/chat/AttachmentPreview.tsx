import { FileText, Image, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import type { ChatAttachment } from '../../types/chat';

interface AttachmentPreviewProps {
  readonly attachment: ChatAttachment;
  readonly onRemove: (id: string) => void;
}

function fileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  const invalid = attachment.uploadStatus === 'invalid' || attachment.uploadStatus === 'error';
  const Icon = attachment.mediaType.startsWith('image/') ? Image : FileText;

  return (
    <div className={`attachment-preview ${invalid ? 'is-invalid' : ''}`}>
      <span className="attachment-preview__icon" aria-hidden="true">
        {attachment.previewUrl && !invalid ? (
          <img src={attachment.previewUrl} alt="" />
        ) : attachment.uploadStatus === 'uploading' ? (
          <LoaderCircle className="spin" size={18} />
        ) : invalid ? (
          <TriangleAlert size={18} />
        ) : (
          <Icon size={18} />
        )}
      </span>
      <span>
        <strong>{attachment.name}</strong>
        <small>{invalid ? attachment.errorMessage : fileSize(attachment.sizeBytes)}</small>
      </span>
      <button type="button" onClick={() => onRemove(attachment.id)} aria-label={`Quitar ${attachment.name}`}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
