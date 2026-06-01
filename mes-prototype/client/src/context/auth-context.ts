import { createContext } from 'react';
import type { User } from '../api';

export interface AuthState {
  user: User | null;
  loading: boolean;
  sessionWarning: string | null;
  renewingSession: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  renewSession: () => Promise<boolean>;
  can: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthState | null>(null);
