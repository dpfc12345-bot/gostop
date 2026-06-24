import type { ReactNode } from 'react';

interface GameShellProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  soundMuted?: boolean;
  onToggleSound?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  immersive?: boolean;
}

export function GameShell({
  title,
  subtitle,
  onBack,
  soundMuted,
  onToggleSound,
  children,
  footer,
  immersive = false,
}: GameShellProps) {
  return (
    <div className="bg-app flex min-h-[100dvh] flex-col">
      <header
        className={`z-30 flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 sm:px-4 ${immersive ? 'glass-panel border-b border-white/5' : 'glass-panel'}`}
        style={{ paddingTop: 'calc(0.5rem + var(--game-safe-top))' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-stone-400 transition hover:bg-white/10 hover:text-white active:scale-95"
              onClick={onBack}
              aria-label="뒤로"
            >
              ←
            </button>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-base tracking-wide text-white sm:text-lg">
              {title}
            </h1>
            {subtitle && !immersive && (
              <p className="truncate text-[10px] text-stone-500">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleSound && (
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-sm transition hover:bg-white/10 active:scale-95"
              onClick={onToggleSound}
              aria-label={soundMuted ? '소리 켜기' : '소리 끄기'}
            >
              {soundMuted ? '🔇' : '🔊'}
            </button>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>

      {footer && !immersive && (
        <footer className="shrink-0 border-t border-white/5 px-3 py-1.5 text-center text-[10px] text-stone-600">
          {footer}
        </footer>
      )}
    </div>
  );
}
