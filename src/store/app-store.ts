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
  // true cuando ya se intentó restaurar la sesión guardada; evita redirigir antes de tiempo.
  hydrated: boolean;
  // Estado real de la zona según el backend.
  serverEmergency: boolean;
  // Interruptor de Perfil para simular la emergencia en la demo.
  simulatedEmergency: boolean;
  emergencyReason: string;
  // Interruptor para simular modo sin señal (offline) durante la presentación.
  simulatedOffline: boolean;
  isOnline: boolean;
  setSession: (session: UserSession) => void;
  clearSession: () => void;
  setHydrated: () => void;
  setServerEmergency: (active: boolean) => void;
  setSimulatedEmergency: (active: boolean) => void;
  setEmergencyReason: (reason: string) => void;
  setSimulatedOffline: (offline: boolean) => void;
  setOnline: (online: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  token: null,
  userId: null,
  zoneId: null,
  userFullName: null,
  userEmail: null,
  hydrated: false,
  serverEmergency: false,
  simulatedEmergency: false,
  emergencyReason: 'Lluvias intensas e inundación en el sector',
  simulatedOffline: false,
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
      serverEmergency: false,
    }),
  setHydrated: () => set({ hydrated: true }),
  setServerEmergency: (active) => set({ serverEmergency: active }),
  setSimulatedEmergency: (active) => set({ simulatedEmergency: active }),
  setEmergencyReason: (reason) => set({ emergencyReason: reason }),
  setSimulatedOffline: (offline) =>
    set({
      simulatedOffline: offline,
      isOnline: !offline,
    }),
  setOnline: (online) =>
    set((s) => ({
      isOnline: s.simulatedOffline ? false : online,
    })),
}));

export const selectEmergencyActive = (s: AppState) => s.serverEmergency || s.simulatedEmergency;
