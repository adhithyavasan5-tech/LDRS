import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './Button';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
}) => {
  const overlayRef = useRef(null);

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={closeOnOverlay ? (e) => { if (e.target === overlayRef.current) onClose(); } : undefined}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className={`glass-card-strong w-full ${sizes[size]} max-h-[90vh] overflow-hidden flex flex-col`}
          >
            {/* Header */}
            {(title || onClose) && (
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b"
                style={{ borderColor: 'var(--border)' }}>
                {title && (
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {title}
                  </h2>
                )}
                <button
                  onClick={onClose}
                  className="ml-auto p-1.5 rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 pb-5 pt-3 border-t flex gap-3 justify-end"
                style={{ borderColor: 'var(--border)' }}>
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
