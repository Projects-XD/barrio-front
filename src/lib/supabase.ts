import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { logger } from '@/utils/logger';


const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY en el .env. Copia .env.example, completa los valores y reinicia Expo con --clear.');
}

/**
 * Adaptador de almacenamiento seguro compatible con Expo Native (SecureStore)
 * y entorno Web (localStorage con fallback en memoria).
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
      } catch (err) { logger.warn('AUTH_STORAGE', 'No se pudo guardar la sesión en el almacenamiento', err); }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) { logger.warn('AUTH_STORAGE', 'No se pudo guardar la sesión en el almacenamiento', err); }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
      } catch (err) { logger.warn('AUTH_STORAGE', 'No se pudo borrar la sesión del almacenamiento', err); }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) { logger.warn('AUTH_STORAGE', 'No se pudo borrar la sesión del almacenamiento', err); }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
