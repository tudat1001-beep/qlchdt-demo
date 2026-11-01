import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | 'phone'
    | 'accessory'
    | 'new'
    | 'used'
    | 'available'
    | 'sold'
    | 'quarantine'
    | 'debt'
    | 'default'
    | 'received'
    | 'processing'
    | 'completed'
    | 'cancelled'
    | 'partially_returned'
    | 'returned';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '' }) => {
  const variantClass = variant !== 'default' ? `badge-${variant}` : '';
  return <span className={`badge ${variantClass} ${className}`}>{children}</span>;
};
