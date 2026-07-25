interface SkeletonProps {
  readonly lines?: number;
  readonly variant?: 'text' | 'card' | 'product';
}

export function Skeleton({ lines = 3, variant = 'text' }: SkeletonProps) {
  return (
    <div className={`skeleton skeleton--${variant}`} aria-label="Cargando contenido" role="status">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} style={{ width: `${Math.max(46, 96 - index * 13)}%` }} />
      ))}
    </div>
  );
}
