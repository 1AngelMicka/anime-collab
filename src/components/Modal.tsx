'use client';
import { ReactNode } from 'react';

export default function Modal({
  open, onClose, children, title,
}: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">{title}</div>
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
        {children}
      </div>
    </div>
  );
}
