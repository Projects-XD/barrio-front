import { create } from 'zustand';

export interface UserSession {
  token: string;
  userId: string;
  zoneId: string;
  zoneName?: string | null;
  userFullName?: string | null;
  userEmail?: string | null;
  emergencyRole?: boolean;
}

type AppState = {
  token: string | null;
  userId: string | null;
  zoneId: string | null;
  zoneName: string | null;
  userFullName: string | null;
  userEmail: string | null;
  emergencyRole: boolean;
  // true cuando ya se intentó restaurar la sesión guardada; evita redirigir antes de tiempo.
  hydrated: boolean;
  // Estado real de la zona según el backend.
  serverEmergency: boolean;
  // Interruptor de Perfil para simular la emergencia en la demo.
  simulatedEmergency: boolean;
  isOnline: boolean;
  setSession: (session: UserSession) => void;
  setZone: (zoneId: string, zoneName?: string | null) => void;
  clearSession: () => void;
  setHydrated: () => void;
  setServerEmergency: (active: boolean) => void;
  setSimulatedEmergency: (active: boolean) => void;
  setOnline: (online: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  token: null,
  userId: null,
  zoneId: null,
  zoneName: null,
  userFullName: null,
  userEmail: null,
  emergencyRole: false,
  hydrated: false,
  serverEmergency: false,
  simulatedEmergency: false,
  isOnline: true,
  setSession: ({
    token,
    userId,
    zoneId,
    zoneName = null,
    userFullName = null,
    userEmail = null,
    emergencyRole = false,
  }) =>
    set((state) => ({
      token,
      userId,
      zoneId: zoneId || state.zoneId,
      zoneName: zoneName ?? state.zoneName,
      userFullName: userFullName ?? state.userFullName,
      userEmail: userEmail ?? state.userEmail,
      emergencyRole: emergencyRole ?? state.emergencyRole,
    })),
  setZone: (zoneId, zoneName = null) => set({ zoneId, zoneName }),
  clearSession: () =>
    set({
      token: null,
      userId: null,
      zoneId: null,
      zoneName: null,
      userFullName: null,
      userEmail: null,
      emergencyRole: false,
      serverEmergency: false,
    }),
  setHydrated: () => set({ hydrated: true }),
  setServerEmergency: (active) => set({ serverEmergency: active }),
  setSimulatedEmergency: (active) => set({ simulatedEmergency: active }),
  setOnline: (online) => set({ isOnline: online }),
}));

export const selectEmergencyActive = (s: AppState) => s.serverEmergency || s.simulatedEmergency;
