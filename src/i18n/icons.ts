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
  otros: 'ellipsis-horizontal-outline',
};

export const favorTypeColor: Record<FavorType, string> = {
  herramienta: '#132E66',
  ayuda_temporal: '#132E66',
  donacion_materiales: '#132E66',
  intercambio_habilidades: '#132E66',
  movilidad_solidaria: '#132E66',
  otros: '#132E66',
};
