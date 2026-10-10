// Shown in place of a whole list that has nothing in it: an icon in a soft
// circle, a title, a short text and, where it helps, one button.
// Small messages inside a list (e.g. "No times") stay plain text (Muted).

import type { ReactNode } from 'react';
import { Icon, type IconName } from '../layout/Icon';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  text?: ReactNode;
  action?: ReactNode; // e.g. a Button or ButtonLink
}

export function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon name={icon} size={24} />
      </span>
      <p className="empty-state-title">{title}</p>
      {text && <p className="empty-state-text">{text}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
