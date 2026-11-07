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
