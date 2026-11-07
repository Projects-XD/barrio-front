import { getPalette } from '@/theme';
import { useAppStore } from '@/store/app-store';

export function usePalette() {
  const emergency = useAppStore((s) => s.emergencyActive);
  return getPalette(emergency);
}
