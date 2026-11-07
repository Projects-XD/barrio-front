import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { BarrioMap } from '@/components/BarrioMap';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import type { BarrioPoint } from '@/components/mapHtml';
import { useFavors, useZones } from '@/hooks/useData';
import { usePalette } from '@/hooks/usePalette';
import { favorTypeIcon } from '@/i18n/icons';
import { favorTypeLabel, favorUrgencyLabel } from '@/i18n/labels';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, shadow, spacing } from '@/theme';
import type { Favor, FavorType, FavorUrgency } from '@/types';
import { CASTILLA_CENTER, type Coords } from '@/utils/geo';
import { distanceKm } from '@/utils/location';
import { timeAgo } from '@/utils/time';

type KindFilter = 'todos' | 'pedir' | 'ofrecer';

const TIPOS = Object.keys(favorTypeLabel) as FavorType[];
const URGENCIAS = Object.keys(favorUrgencyLabel) as FavorUrgency[];

// Detecta si el favor es un ofrecimiento ("Ofrezco", "Tengo...", "Presto...", "Dono...", "Puedo...")
// o un pedido de ayuda ("Necesito", etc.).
function kindOf(title: string, description?: string | null): 'pedir' | 'ofrecer' {
  const text = `${title} ${description ?? ''}`.trim();
  if (/^(ofrezco|ofrece|tengo\s+para\s+prestar|presto|dono|regalo|puedo\s+ayudar|puedo\s+enseñar)/i.test(text)) {
    return 'ofrecer';
  }
  return 'pedir';
}

// Pequeño desplazamiento determinístico en espiral a partir del ID para que dos favores
// en la misma coordenada o en el centro de la zona nunca se tapen entre sí.
function deterministicOffset(id: string, index: number): { dLat: number; dLng: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const angle = ((Math.abs(hash) % 360) + index * 47) * (Math.PI / 180);
  const ring = 1 + (index % 3) * 0.55;
  const radiusDeg = 0.00055 * ring; // ~60 m - 120 m
  return {
    dLat: Math.sin(angle) * radiusDeg,
    dLng: Math.cos(angle) * radiusDeg,
  };
}

export default function MapaBarrio() {
  const p = usePalette();
  const zoneId = useAppStore((s) => s.zoneId);
  const { data: zonas = [] } = useZones();
  const { data: favores = [], isLoading, isError, refetch } = useFavors();

  const [busqueda, setBusqueda] = useState('');
  const [filtroIntencion, setFiltroIntencion] = useState<KindFilter>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<FavorType | undefined>(undefined);
  const [filtroUrgencia, setFiltroUrgencia] = useState<FavorUrgency | undefined>(undefined);
  const [modalFiltros, setModalFiltros] = useState(false);
  const [modalLista, setModalLista] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);

  const zona = zonas.find((z) => z.id === zoneId);
  const center: Coords =
    zona && zona.center_lat != null && zona.center_lng != null
      ? { lat: zona.center_lat, lng: zona.center_lng }
      : CASTILLA_CENTER;

  // Todos los favores activos (incluyendo propios pendientes o en cola offline) con coordenadas normalizadas
  // dentro del radio del barrio y sin superposición exacta.
  const allMapped = useMemo(() => {
    const active = favores.filter((f) => f.status === 'abierta' || f.status === 'en_curso');
    const seenCoords = new Map<string, number>();

    return active.map((f, idx) => {
      const kind = kindOf(f.title, f.description);
      let baseLat = f.location?.lat ?? center.lat;
      let baseLng = f.location?.lng ?? center.lng;

      // Si una coordenada quedó fuera del radio razonable de la zona (> 8 km, p. ej. emulador o sin señal),
      // se acerca al centro del barrio con un desplazamiento determinístico para que siempre sea visible.
      const outOfZone =
        f.location == null || distanceKm(baseLat, baseLng, center.lat, center.lng) > 8;
      if (outOfZone) {
        const off = deterministicOffset(f.id, idx);
        baseLat = Number((center.lat + off.dLat * 2.2).toFixed(5));
        baseLng = Number((center.lng + off.dLng * 2.2).toFixed(5));
      } else {
        const key = `${baseLat.toFixed(4)},${baseLng.toFixed(4)}`;
        const count = seenCoords.get(key) ?? 0;
        seenCoords.set(key, count + 1);
        if (count > 0) {
          const off = deterministicOffset(f.id, count);
          baseLat = Number((baseLat + off.dLat).toFixed(5));
          baseLng = Number((baseLng + off.dLng).toFixed(5));
        }
      }

      const point: BarrioPoint = {
        id: f.id,
        lat: baseLat,
        lng: baseLng,
        kind,
        label: f.title.length > 52 ? `${f.title.slice(0, 52)}…` : f.title,
        urgency: f.urgency,
        type: f.type,
        authorName: f.author.fullName,
      };

      return { favor: f, point, kind };
    });
  }, [favores, center.lat, center.lng]);

  const totalPedidos = useMemo(
    () => allMapped.filter((x) => x.kind === 'pedir').length,
    [allMapped],
  );
  const totalOfrecidos = useMemo(
    () => allMapped.filter((x) => x.kind === 'ofrecer').length,
    [allMapped],
  );

  const filteredItems = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return allMapped.filter(({ favor, kind }) => {
      if (filtroIntencion !== 'todos' && kind !== filtroIntencion) return false;
      if (filtroCategoria && favor.type !== filtroCategoria) return false;
      if (filtroUrgencia && favor.urgency !== filtroUrgencia) return false;
      if (q) {
        const matchTitle = favor.title.toLowerCase().includes(q);
        const matchDesc = (favor.description ?? '').toLowerCase().includes(q);
        const matchAuthor = favor.author.fullName.toLowerCase().includes(q);
        const matchCat = favorTypeLabel[favor.type].toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchAuthor && !matchCat) return false;
      }
      return true;
    });
  }, [allMapped, busqueda, filtroIntencion, filtroCategoria, filtroUrgencia]);

  const points = useMemo(() => filteredItems.map((x) => x.point), [filteredItems]);

  const selectedEntry = useMemo(
    () => (selectedId ? filteredItems.find((x) => x.favor.id === selectedId) ?? null : null),
    [filteredItems, selectedId],
  );

  const activeFilterCount =
    (filtroIntencion !== 'todos' ? 1 : 0) +
    (filtroCategoria ? 1 : 0) +
    (filtroUrgencia ? 1 : 0) +
    (busqueda.trim() ? 1 : 0);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroIntencion('todos');
    setFiltroCategoria(undefined);
    setFiltroUrgencia(undefined);
    setSelectedId(null);
    setFitTrigger((n) => n + 1);
  };

  const abrirDetalle = (favor: Favor) => {
    if (favor.syncStatus !== 'enviado') return;
    router.push(`/favores/${favor.id}`);
  };

  return (
    <Screen scroll={false}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.titulo, { color: p.text }]}>Mapa del barrio</Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            {zona?.name ? `Zona ${zona.name} · ` : ''}
            {filteredItems.length} de {allMapped.length} publicaciones visibles
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver resultados en lista"
          onPress={() => setModalLista(true)}
          style={[styles.topActionBtn, { backgroundColor: colors.blanco, borderColor: p.border }]}
        >
          <Ionicons name="list-outline" size={20} color={colors.azul} />
          <Text style={styles.topActionText}>Lista ({filteredItems.length})</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={p.primary} />
          <Text style={[styles.loaderText, { color: p.muted }]}>Cargando puntos del barrio...</Text>
        </View>
      ) : isError ? (
        <View style={styles.aviso}>
          <Ionicons name="cloud-offline-outline" size={22} color={colors.azul} />
          <Text style={[styles.avisoTexto, { color: p.text }]} onPress={() => refetch()}>
            No pudimos cargar el mapa. Toca aquí para reintentar.
          </Text>
        </View>
      ) : (
        <View style={styles.mapContainer}>
          <BarrioMap
            center={center}
            points={points}
            selectedId={selectedId}
            fitTrigger={fitTrigger}
            onPointPress={(id) => setSelectedId(id)}
            onMapClear={() => setSelectedId(null)}
            height={520}
          />

          {/* VENTANA FLOTANTE SUPERIOR: Buscador + Botón de filtros precisos + Chips rápidos */}
          <View style={styles.floatingTop} pointerEvents="box-none">
            <View style={styles.searchRow}>
              <View style={[styles.searchBox, { borderColor: p.border }]}>
                <Ionicons name="search-outline" size={18} color={colors.gris} />
                <TextInput
                  value={busqueda}
                  onChangeText={(txt) => {
                    setBusqueda(txt);
                    setSelectedId(null);
                  }}
                  placeholder="Buscar herramienta, vecino, favor..."
                  placeholderTextColor={colors.gris}
                  style={[styles.searchInput, { color: p.text }]}
                  returnKeyType="search"
                />
                {busqueda.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Limpiar búsqueda"
                    onPress={() => setBusqueda('')}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.gris} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir ventana de filtros avanzados"
                onPress={() => setModalFiltros(true)}
                style={[
                  styles.filterFloatingBtn,
                  {
                    backgroundColor: activeFilterCount > 0 ? colors.azul : colors.blanco,
                    borderColor: activeFilterCount > 0 ? colors.azul : p.border,
                  },
                ]}
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={activeFilterCount > 0 ? colors.blanco : colors.azul}
                />
                {activeFilterCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>

            {/* Píldoras flotantes de intención (Todos / Piden / Ofrecen) y filtros activos */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.floatingPills}
            >
              <Pressable
                onPress={() => {
                  setFiltroIntencion('todos');
                  setSelectedId(null);
                  setFitTrigger((n) => n + 1);
                }}
                style={[
                  styles.pillBtn,
                  filtroIntencion === 'todos' ? styles.pillBtnActiveAll : styles.pillBtnIdle,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: filtroIntencion === 'todos' ? colors.blanco : colors.azul },
                  ]}
                >
                  Todos ({allMapped.length})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setFiltroIntencion(filtroIntencion === 'pedir' ? 'todos' : 'pedir');
                  setSelectedId(null);
                  setFitTrigger((n) => n + 1);
                }}
                style={[
                  styles.pillBtn,
                  filtroIntencion === 'pedir' ? styles.pillBtnActivePedir : styles.pillBtnIdle,
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: filtroIntencion === 'pedir' ? colors.blanco : colors.azul },
                  ]}
                />
                <Text
                  style={[
                    styles.pillText,
                    { color: filtroIntencion === 'pedir' ? colors.blanco : colors.azul },
                  ]}
                >
                  {totalPedidos} piden ayuda
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setFiltroIntencion(filtroIntencion === 'ofrecer' ? 'todos' : 'ofrecer');
                  setSelectedId(null);
                  setFitTrigger((n) => n + 1);
                }}
                style={[
                  styles.pillBtn,
                  filtroIntencion === 'ofrecer' ? styles.pillBtnActiveOfrecer : styles.pillBtnIdle,
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: filtroIntencion === 'ofrecer' ? colors.azul : colors.naranja },
                  ]}
                />
                <Text style={[styles.pillText, { color: colors.azul }]}>
                  {totalOfrecidos} ofrecen ayuda
                </Text>
              </Pressable>

              {filtroCategoria ? (
                <Pressable
                  onPress={() => setFiltroCategoria(undefined)}
                  style={[styles.pillBtn, styles.pillBtnActiveTag]}
                >
                  <Text style={[styles.pillText, { color: colors.azul }]}>
                    {favorTypeLabel[filtroCategoria]} ✕
                  </Text>
                </Pressable>
              ) : null}

              {filtroUrgencia ? (
                <Pressable
                  onPress={() => setFiltroUrgencia(undefined)}
                  style={[styles.pillBtn, styles.pillBtnActiveTag]}
                >
                  <Text style={[styles.pillText, { color: colors.azul }]}>
                    {favorUrgencyLabel[filtroUrgencia]} ✕
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>

          {/* BOTONES FLOTANTES LATERALES: Encuadrar todos los puntos / Limpiar filtros */}
          <View style={styles.floatingSide} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver todos los puntos en el mapa"
              onPress={() => {
                setSelectedId(null);
                setFitTrigger((n) => n + 1);
              }}
              style={styles.sideBtn}
            >
              <Ionicons name="scan-outline" size={20} color={colors.azul} />
            </Pressable>
            {activeFilterCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Restablecer todos los filtros"
                onPress={limpiarFiltros}
                style={[styles.sideBtn, { backgroundColor: colors.naranjaSuave }]}
              >
                <Ionicons name="refresh-outline" size={20} color={colors.azul} />
              </Pressable>
            ) : null}
          </View>

          {/* VENTANA FLOTANTE INFERIOR: Vista previa del punto seleccionado */}
          {selectedEntry ? (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View
                  style={[
                    styles.previewKindBadge,
                    {
                      backgroundColor:
                        selectedEntry.kind === 'ofrecer' ? colors.naranjaSuave : colors.azulSuave,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          selectedEntry.kind === 'ofrecer' ? colors.naranja : colors.azul,
                      },
                    ]}
                  />
                  <Text style={[styles.previewKindText, { color: colors.azul }]}>
                    {selectedEntry.kind === 'ofrecer' ? 'Ofrece ayuda' : 'Pide ayuda'}
                  </Text>
                </View>

                <UrgencyBadge urgency={selectedEntry.favor.urgency} />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar vista previa"
                  onPress={() => setSelectedId(null)}
                  hitSlop={10}
                  style={{ marginLeft: 'auto' }}
                >
                  <Ionicons name="close" size={20} color={colors.gris} />
                </Pressable>
              </View>

              <View style={styles.previewBody}>
                <View style={[styles.previewIcon, { backgroundColor: p.highlight }]}>
                  <Ionicons
                    name={favorTypeIcon[selectedEntry.favor.type]}
                    size={22}
                    color={colors.azul}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewCategory, { color: p.muted }]}>
                    {favorTypeLabel[selectedEntry.favor.type]}
                  </Text>
                  <Text style={[styles.previewTitle, { color: p.text }]} numberOfLines={2}>
                    {selectedEntry.favor.title}
                  </Text>
                  <Text style={[styles.previewMeta, { color: p.muted }]}>
                    {selectedEntry.favor.author.fullName} · {timeAgo(selectedEntry.favor.createdAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.previewActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => abrirDetalle(selectedEntry.favor)}
                  style={[styles.previewPrimaryBtn, { backgroundColor: p.cta }]}
                >
                  <Text style={[styles.previewPrimaryText, { color: p.ctaText }]}>
                    Ver detalle del favor
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={p.ctaText} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      )}

      <Text style={[styles.nota, { color: p.muted }]}>
        Toca un punto para ver quién publica o usa los filtros flotantes para afinar tu búsqueda.
      </Text>

      {/* VENTANA FLOTANTE / MODAL DE FILTROS PRECISOS */}
      <Modal
        visible={modalFiltros}
        transparent
        animationType="fade"
        onRequestClose={() => setModalFiltros(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalFiltros(false)}>
          <Pressable onPress={() => {}} style={styles.floatingSheet}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: p.text }]}>Filtros de búsqueda</Text>
              <Pressable onPress={() => setModalFiltros(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={26} color={colors.gris} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.filterSectionTitle, { color: p.text }]}>
                1. ¿Qué deseas buscar en el mapa?
              </Text>
              <View style={styles.chipWrap}>
                <Chip
                  label={`Todos (${allMapped.length})`}
                  selected={filtroIntencion === 'todos'}
                  onPress={() => setFiltroIntencion('todos')}
                />
                <Chip
                  label={`Piden ayuda (${totalPedidos})`}
                  selected={filtroIntencion === 'pedir'}
                  onPress={() => setFiltroIntencion('pedir')}
                />
                <Chip
                  label={`Ofrecen ayuda (${totalOfrecidos})`}
                  selected={filtroIntencion === 'ofrecer'}
                  onPress={() => setFiltroIntencion('ofrecer')}
                />
              </View>

              <Text style={[styles.filterSectionTitle, { color: p.text }]}>
                2. Categoría del favor
              </Text>
              <View style={styles.chipWrap}>
                <Chip
                  label="Todas las categorías"
                  selected={!filtroCategoria}
                  onPress={() => setFiltroCategoria(undefined)}
                />
                {TIPOS.map((t) => (
                  <Chip
                    key={t}
                    label={favorTypeLabel[t]}
                    selected={filtroCategoria === t}
                    onPress={() => setFiltroCategoria(filtroCategoria === t ? undefined : t)}
                  />
                ))}
              </View>

              <Text style={[styles.filterSectionTitle, { color: p.text }]}>
                3. Nivel de urgencia
              </Text>
              <View style={styles.chipWrap}>
                <Chip
                  label="Cualquier urgencia"
                  selected={!filtroUrgencia}
                  onPress={() => setFiltroUrgencia(undefined)}
                />
                {URGENCIAS.map((u) => (
                  <Chip
                    key={u}
                    label={favorUrgencyLabel[u]}
                    selected={filtroUrgencia === u}
                    onPress={() => setFiltroUrgencia(filtroUrgencia === u ? undefined : u)}
                  />
                ))}
              </View>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <AppButton
                label={`Ver ${filteredItems.length} resultado${filteredItems.length === 1 ? '' : 's'} en el mapa`}
                icon="map-outline"
                onPress={() => {
                  setModalFiltros(false);
                  setFitTrigger((n) => n + 1);
                }}
              />
              {activeFilterCount > 0 ? (
                <AppButton
                  label="Limpiar filtros"
                  variant="secondary"
                  icon="refresh-outline"
                  onPress={limpiarFiltros}
                />
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* VENTANA FLOTANTE DE RESULTADOS EN LISTA RÁPIDA (permite ubicar un punto en el mapa o ir al detalle) */}
      <Modal
        visible={modalLista}
        transparent
        animationType="fade"
        onRequestClose={() => setModalLista(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalLista(false)}>
          <Pressable onPress={() => {}} style={styles.floatingSheet}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: p.text }]}>
                Puntos en el mapa ({filteredItems.length})
              </Text>
              <Pressable onPress={() => setModalLista(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={26} color={colors.gris} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {filteredItems.length === 0 ? (
                <Text style={[styles.emptyListText, { color: p.muted }]}>
                  No hay favores que coincidan con tus filtros actuales.
                </Text>
              ) : (
                filteredItems.map(({ favor, kind }) => (
                  <Pressable
                    key={favor.id}
                    onPress={() => {
                      setSelectedId(favor.id);
                      setModalLista(false);
                    }}
                    style={[styles.listRow, { borderColor: p.border }]}
                  >
                    <View
                      style={[
                        styles.listDot,
                        { backgroundColor: kind === 'ofrecer' ? colors.naranja : colors.azul },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listKind, { color: p.muted }]}>
                        {kind === 'ofrecer' ? 'Ofrece ayuda' : 'Pide ayuda'} ·{' '}
                        {favorTypeLabel[favor.type]}
                      </Text>
                      <Text style={[styles.listTitle, { color: p.text }]} numberOfLines={2}>
                        {favor.title}
                      </Text>
                      <Text style={[styles.listAuthor, { color: p.muted }]}>
                        {favor.author.fullName} · {timeAgo(favor.createdAt)}
                      </Text>
                    </View>
                    <Ionicons name="locate-outline" size={20} color={colors.azul} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: spacing.sm,
  },
  titulo: { fontFamily: fonts.bold, fontSize: 26 },
  sub: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  topActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    ...shadow,
  },
  topActionText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.azul },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loaderText: { fontFamily: fonts.medium, fontSize: 14 },

  mapContainer: {
    flex: 1,
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
  },

  floatingTop: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 20,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    ...shadow,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterFloatingBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...shadow,
  },
  filterBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.naranja,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.azul,
  },

  floatingPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    ...shadow,
  },
  pillBtnIdle: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#EAE3D8',
  },
  pillBtnActiveAll: {
    backgroundColor: colors.azul,
    borderColor: colors.azul,
  },
  pillBtnActivePedir: {
    backgroundColor: colors.azul,
    borderColor: colors.azul,
  },
  pillBtnActiveOfrecer: {
    backgroundColor: colors.naranja,
    borderColor: colors.naranja,
  },
  pillBtnActiveTag: {
    backgroundColor: colors.naranjaSuave,
    borderColor: colors.naranja,
  },
  pillText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },

  floatingSide: {
    position: 'absolute',
    right: 10,
    top: 108,
    zIndex: 20,
    gap: 8,
  },
  sideBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAE3D8',
    ...shadow,
  },

  previewCard: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 30,
    backgroundColor: colors.blanco,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAE3D8',
    ...shadow,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  previewKindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  previewKindText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  previewBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCategory: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  previewTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 21,
    marginTop: 1,
  },
  previewMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 2,
  },
  previewActions: {
    marginTop: 10,
  },
  previewPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  previewPrimaryText: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },

  aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md },
  avisoTexto: { fontFamily: fonts.semiBold, fontSize: 15, textDecorationLine: 'underline' },
  nota: { fontFamily: fonts.regular, fontSize: 12, marginTop: 6 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 46, 102, 0.48)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  floatingSheet: {
    backgroundColor: colors.blanco,
    borderRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '84%',
    ...shadow,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  filterSectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    marginTop: spacing.sm,
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sheetFooter: {
    marginTop: spacing.md,
  },

  emptyListText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  listDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  listKind: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  listTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    marginTop: 2,
  },
  listAuthor: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 2,
  },
});

