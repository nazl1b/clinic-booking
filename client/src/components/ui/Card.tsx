// White box that groups content. With `onSubmit` it renders as a <form>.

import type { FormEvent, ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  titleLevel?: 1 | 2; // 1 when the card is the whole page (auth pages)
  description?: ReactNode;
  actions?: ReactNode; // shown on the right of the title
  tone?: 'default' | 'danger';
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  role?: string;
  children?: ReactNode;
}

export function Card({ title, titleLevel = 2, description, actions, tone = 'default', onSubmit, role, children }: CardProps) {
  const className = `card${tone === 'danger' ? ' card-danger' : ''}`;
  const header = (title || actions) && (
    <div className="card-header">
      <div>
        {title && (titleLevel === 1 ? <h1 className="card-title">{title}</h1> : <h2 className="card-title">{title}</h2>)}
        {description && <p className="card-description">{description}</p>}
      </div>
      {actions && <div className="card-actions">{actions}</div>}
    </div>
  );

  if (onSubmit) {
    return (
      <form className={className} onSubmit={onSubmit} role={role}>
        {header}
        {children}
      </form>
    );
  }
  return (
    <section className={className} role={role}>
      {header}
      {children}
    </section>
  );
}
