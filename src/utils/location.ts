import * as Location from 'expo-location';
import { Linking } from 'react-native';

export const normalizeText = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Tiempo de espera agotado')), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });
}

export type PositionResult =
  | { status: 'denied' }
  | { status: 'granted'; lat: number; lng: number };

// Pide permiso y obtiene la posición real del dispositivo (funciona en celular y en navegador).
export async function getRealPosition(): Promise<PositionResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { status: 'denied' };
  const pos = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    15000,
  );
  return { status: 'granted', lat: pos.coords.latitude, lng: pos.coords.longitude };
}

async function expoPlaceTexts(lat: number, lng: number): Promise<string[]> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    return [place?.district, place?.subregion, place?.city, place?.region, place?.name].filter(
      (v): v is string => Boolean(v),
    );
  } catch {
    // En navegador esta función puede no estar disponible: se usa el respaldo de OpenStreetMap.
    return [];
  }
}

async function osmPlaceTexts(lat: number, lng: number): Promise<string[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=16&accept-language=es&lat=${lat}&lon=${lng}`;
    const res = await withTimeout(fetch(url), 10000);
    if (!res.ok) return [];
    const data = (await res.json()) as { address?: Record<string, string> };
    return Object.values(data.address ?? {});
  } catch {
    return [];
  }
}

// Textos normalizados (sin tildes, en minúscula) con los nombres de lugar cercanos.
export async function placeTexts(lat: number, lng: number): Promise<string[]> {
  const [expo, osm] = await Promise.all([expoPlaceTexts(lat, lng), osmPlaceTexts(lat, lng)]);
  return [...expo, ...osm].map(normalizeText);
}

// Distancia en km entre dos puntos (fórmula de Haversine).
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function openLocationSettings() {
  Linking.openSettings().catch(() => {});
}
