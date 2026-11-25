import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/55 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative bg-white/95 rounded-[1.75rem] max-w-lg w-full max-h-[90dvh] flex flex-col shadow-[0_30px_90px_-28px_rgba(15,23,42,0.55)] border border-white/90 ring-1 ring-white/50 backdrop-blur-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100/90 bg-white/70 shrink-0">
          <h3 className="min-w-0 flex-1 break-words font-bold text-base sm:text-lg text-slate-900 pr-2">{title}</h3>
          <button
            onClick={onClose}
            className="h-11 w-11 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100/90 transition-colors cursor-pointer shrink-0 inline-flex items-center justify-center"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
