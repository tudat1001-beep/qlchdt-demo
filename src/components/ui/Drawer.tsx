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
    if (!isOpen) return;

    previousFocus.current = document.activeElement as HTMLElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusableElements = (): HTMLElement[] => {
      if (!drawerRef.current) return [];
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(focusable).filter((el) => el.offsetParent !== null);
    };

    // Immediate initial focus to close button
    requestAnimationFrame(() => {
      if (drawerRef.current) {
        const closeBtn = drawerRef.current.querySelector<HTMLElement>('button[aria-label="Đóng ngăn chi tiết"]');
        if (closeBtn) {
          closeBtn.focus();
        } else {
          const focusable = getFocusableElements();
          if (focusable.length > 0) focusable[0].focus();
        }
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const firstEl = focusable[0];
        const lastEl = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previousFocus.current && typeof previousFocus.current.focus === 'function') {
        previousFocus.current.focus();
      }
    };
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
