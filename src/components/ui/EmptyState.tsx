import React from 'react';
import { PackageSearch } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="empty-state-box">
      <div className="empty-state-icon">
        {icon || <PackageSearch size={24} />}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction} style={{ marginTop: 8 }}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
