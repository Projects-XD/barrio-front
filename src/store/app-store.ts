import { create } from 'zustand';

type AppState = {
  token: string | null;
  userId: string | null;
  zoneId: string | null;
  emergencyActive: boolean;
  isOnline: boolean;
  setSession: (session: { token: string; userId: string; zoneId: string }) => void;
  clearSession: () => void;
  setEmergency: (active: boolean) => void;
  setOnline: (online: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  token: null,
  userId: null,
  zoneId: null,
  emergencyActive: false,
  isOnline: true,
  setSession: ({ token, userId, zoneId }) => set({ token, userId, zoneId }),
  clearSession: () => set({ token: null, userId: null, zoneId: null }),
  setEmergency: (active) => set({ emergencyActive: active }),
  setOnline: (online) => set({ isOnline: online }),
}));
