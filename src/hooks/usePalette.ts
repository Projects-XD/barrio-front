import { getPalette } from '@/theme';
import { selectEmergencyActive, useAppStore } from '@/store/app-store';

export function usePalette() {
  const emergency = useAppStore(selectEmergencyActive);
  return getPalette(emergency);
}
