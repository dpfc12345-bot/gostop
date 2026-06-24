import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Input({ label, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label;
  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-400">{label}</span>
      <input
        id={inputId}
        className={`w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-stone-100 placeholder:text-stone-600 outline-none transition focus:border-[var(--color-gold)] focus:ring-2 focus:ring-[var(--color-gold)]/20 ${className}`}
        {...props}
      />
    </label>
  );
}
