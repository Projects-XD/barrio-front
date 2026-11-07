import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { FavorType, OficioCategory } from '@/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const favorTypeIcon: Record<FavorType, IconName> = {
  herramienta: 'hammer-outline',
  ayuda_temporal: 'time-outline',
  donacion_materiales: 'cube-outline',
  intercambio_habilidades: 'bulb-outline',
  movilidad_solidaria: 'car-outline',
  otros: 'ellipsis-horizontal-outline',
};

export const oficioIcon: Record<OficioCategory, IconName> = {
  gasfiteria: 'water-outline',
  carpinteria: 'hammer-outline',
  electricidad: 'flash-outline',
  cerrajeria: 'key-outline',
  clases: 'school-outline',
  paseador_mascotas: 'paw-outline',
  otro: 'construct-outline',
};
