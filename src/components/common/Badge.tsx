import type { ReactNode } from 'react';

interface BadgeProps {
  readonly children: ReactNode;
  readonly tone?: 'neutral' | 'lime' | 'dark';
  readonly icon?: ReactNode;
  readonly className?: string;
}

export function Badge({ children, tone = 'neutral', icon, className = '' }: BadgeProps) {
  return (
    <span className={`badge ${tone === 'neutral' ? '' : `badge--${tone}`} ${className}`}>
      {icon}
      {children}
    </span>
  );
}
