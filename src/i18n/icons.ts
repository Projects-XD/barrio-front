import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { FavorType } from '@/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const favorTypeIcon: Record<FavorType, IconName> = {
  herramienta: 'hammer-outline',
  ayuda_temporal: 'time-outline',
  donacion_materiales: 'cube-outline',
  intercambio_habilidades: 'bulb-outline',
  movilidad_solidaria: 'car-outline',
};

export const favorTypeColor: Record<FavorType, string> = {
  herramienta: '#132E66',
  ayuda_temporal: '#EA982B',
  donacion_materiales: '#2E7D5B',
  intercambio_habilidades: '#7A4FB0',
  movilidad_solidaria: '#1E8C9A',
};
