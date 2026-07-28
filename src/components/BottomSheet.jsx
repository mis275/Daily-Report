import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * iOS-style bottom sheet pop-up component.
 * On mobile: slides up from bottom with a drag handle.
 * On desktop (sm+): renders as a centered modal dialog.
 * Uses React Portal to ensure it renders above all other elements (e.g. fixed footers).
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - title: string
 *  - subtitle?: string
 *  - headerColor?: 'default' | 'indigo' | 'sky'   (default = white)
 *  - children: ReactNode  (scrollable body)
 *  - footer: ReactNode    (sticky footer with action buttons)
 */
export default function BottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  headerColor = 'default',
  children,
  footer,
}) {
  const sheetRef = useRef(null);

  // Lock body scroll when sheet is open (iOS scroll-lock fix)
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const headerBg = {
    default: 'bg-white border-b border-gray-100',
    indigo: 'bg-indigo-900 text-white',
    sky: 'bg-sky-700 text-white',
  }[headerColor] ?? 'bg-white border-b border-gray-100';

  const titleColor = headerColor === 'default'
    ? 'text-gray-900'
    : 'text-white';

  const subtitleColor = headerColor === 'default'
    ? 'text-gray-400'
    : (headerColor === 'indigo' ? 'text-indigo-300' : 'text-sky-200');

  const closeColor = headerColor === 'default'
    ? 'text-gray-400 hover:text-red-500'
    : 'text-white/60 hover:text-white';

  const modalContent = (
    /* Backdrop */
    <div
      className="fixed inset-x-0 top-0 z-[100] flex flex-col items-center justify-end sm:justify-center"
      style={{ height: '100dvh', backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="
          relative w-full sm:max-w-lg
          bg-white
          rounded-t-[28px] sm:rounded-2xl
          shadow-2xl
          flex flex-col
          overflow-hidden
          animate-sheet-up sm:animate-zoom-in
        "
        style={{
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 20px) - 8px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Drag Handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className={`px-5 py-4 flex justify-between items-start flex-shrink-0 ${headerBg}`}>
          <div>
            <h2 className={`text-base font-black uppercase tracking-tight leading-tight ${titleColor}`}>
              {title}
            </h2>
            {subtitle && (
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${subtitleColor}`}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors ml-4 flex-shrink-0 ${closeColor}`}
          >
            <X size={22} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>

        {/* Footer — always pinned */}
        {footer && (
          <div
            className="flex-shrink-0 border-t border-gray-100 bg-gray-50/80 backdrop-blur-sm px-4 pt-3"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
