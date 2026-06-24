import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
  centered?: boolean;
}

export function AppShell({ children, centered }: AppShellProps) {
  return (
    <div className={`bg-app min-h-[100dvh] ${centered ? 'flex items-center justify-center p-4' : ''}`}>
      {children}
    </div>
  );
}
