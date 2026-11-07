import { create } from 'zustand';

export interface UserSession {
  token: string;
  userId: string;
  zoneId: string;
  userFullName?: string | null;
  userEmail?: string | null;
}

type AppState = {
  token: string | null;
  userId: string | null;
  zoneId: string | null;
  userFullName: string | null;
  userEmail: string | null;
  emergencyActive: boolean;
  isOnline: boolean;
  setSession: (session: UserSession) => void;
  clearSession: () => void;
  setEmergency: (active: boolean) => void;
  setOnline: (online: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  token: null,
  userId: null,
  zoneId: null,
  userFullName: null,
  userEmail: null,
  emergencyActive: false,
  isOnline: true,
  setSession: ({ token, userId, zoneId, userFullName = null, userEmail = null }) =>
    set({ token, userId, zoneId, userFullName, userEmail }),
  clearSession: () =>
    set({
      token: null,
      userId: null,
      zoneId: null,
      userFullName: null,
      userEmail: null,
    }),
  setEmergency: (active) => set({ emergencyActive: active }),
  setOnline: (online) => set({ isOnline: online }),
}));
