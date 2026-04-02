/**
 * Reusable Modal Component
 */
import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6 border-b-2 border-brand-blue pb-4">
          <h2 className="text-xl font-bold text-brand-dark" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>
          <button onClick={onClose} className="btn-icon btn-secondary text-surface-500 hover:text-surface-800">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
