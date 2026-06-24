export interface DevUser {
  userId: string;
  nickname: string;
}

const KEY = 'gostop:dev-user';

export function loadUser(): DevUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DevUser;
  } catch {
    return null;
  }
}

export function saveUser(user: DevUser): void {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(KEY);
}

export function defaultUserId(): string {
  return `dev-${crypto.randomUUID().slice(0, 8)}`;
}
