/**
 * Toast notification component
 */
import { useState, useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose, duration = 4000 }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`toast toast-${type}`}
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
    >
      {type === 'success' ? '✓ ' : '✕ '}{message}
    </div>
  );
}
