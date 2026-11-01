import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '520px',
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      // Focus close button inside drawer
      setTimeout(() => {
        if (drawerRef.current) {
          const closeBtn = drawerRef.current.querySelector<HTMLElement>('button[aria-label="Đóng ngăn chi tiết"]');
          closeBtn?.focus();
        }
      }, 50);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        if (previousFocus.current) {
          previousFocus.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div
        ref={drawerRef}
        className="drawer-card"
        style={{ maxWidth }}
      >
        <div className="drawer-header">
          <div className="drawer-title-group">
            <h2 id="drawer-title" className="drawer-title">
              {title}
            </h2>
            {subtitle && <span className="drawer-subtitle">{subtitle}</span>}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Đóng ngăn chi tiết"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {children}
        </div>

        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </div>
  );
};
