import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { BarrioMap } from '@/components/BarrioMap';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import type { BarrioPoint } from '@/components/mapHtml';
import { useFavors, useMySavedLocation, useProfiles, useReports, useZones } from '@/hooks/useData';
import { expressInterest, listConversations } from '@/api/endpoints';
import { usePalette } from '@/hooks/usePalette';
import { favorTypeIcon, type IconName } from '@/i18n/icons';
import { favorTypeLabel, favorUrgencyLabel, resourceLabel } from '@/i18n/labels';
import { selectEmergencyActive, useAppStore } from '@/store/app-store';
import { colors } from '@/theme';
import type {
  Favor,
  FavorType,
  FavorUrgency,
  ProfessionalProfile,
  VulnerabilityReport,
} from '@/types';
import { CASTILLA_CENTER, formatDistanceAndWalk, roundForReport, type Coords } from '@/utils/geo';
import { distanceKm, getRealPosition } from '@/utils/location';
import { timeAgo } from '@/utils/time';
import { styles } from '@/features/mapa/styles';

type KindFilter = 'todos' | 'pedir' | 'ofrecer' | 'oficio' | 'emergencia';

// Mismo radio que usa normalizeCoord para decidir si un punto "pertenece" a la zona.
const ZONE_MATCH_RADIUS_KM = 8;

type MapEntry = {
  id: string;
  kind: 'pedir' | 'ofrecer' | 'oficio' | 'emergencia';
  title: string;
  subtitle: string;
  categoryLabel: string;
  authorName: string;
  createdAt?: string;
  urgency?: FavorUrgency;
  favorType?: FavorType;
  icon: IconName;
  point: BarrioPoint;
  distanceMeters: number | null;
  favor?: Favor;
  profile?: ProfessionalProfile;
  report?: VulnerabilityReport;
};

const TIPOS = Object.keys(favorTypeLabel) as FavorType[];
const URGENCIAS = Object.keys(favorUrgencyLabel) as FavorUrgency[];

// Pequeño desplazamiento determinístico en espiral a partir del ID para que dos puntos
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

function formatDistance(meters: number | null): string | null {
  return formatDistanceAndWalk(meters);
}

export default function MapaBarrio() {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const isWide = width >= 920;

  const zoneId = useAppStore((s) => s.zoneId);
  const emergencyActive = useAppStore(selectEmergencyActive);
  const { data: zonas = [] } = useZones();
  const { data: favores = [], isLoading, isError, refetch } = useFavors();
  const { data: oficios = [] } = useProfiles();
  const { data: reportes = [] } = useReports();
  const { data: savedLocation } = useMySavedLocation();

  const [busqueda, setBusqueda] = useState('');
  const [filtroIntencion, setFiltroIntencion] = useState<KindFilter>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<FavorType | undefined>(undefined);
  const [filtroUrgencia, setFiltroUrgencia] = useState<FavorUrgency | undefined>(undefined);
  const userId = useAppStore((s) => s.userId);

  // Mismo flujo que la pantalla del favor: el autor abre su chat, el interesado abre o crea el suyo.
  const abrirChat = async (entry: MapEntry) => {
    const favor = entry.favor;
    if (!favor) return;
    try {
      if (favor.authorId === userId || favor.hasInterestedByMe) {
        const convs = await listConversations(favor.id);
        if (convs.length > 0) {
          router.push(`/chat/${convs[0].id}`);
          return;
        }
        if (favor.authorId === userId) {
          Alert.alert('Sin chats', 'Aún nadie ha respondido a este favor.');
          return;
        }
      }
      const { conversation_id } = await expressInterest(favor.id);
      router.push(`/chat/${conversation_id}`);
    } catch (err) {
      Alert.alert('No se pudo abrir el chat', (err as Error).message);
    }
  };

  const [mostrarCapaOficios, setMostrarCapaOficios] = useState<boolean>(false);
  const [mostrarCapaAlertas, setMostrarCapaAlertas] = useState<boolean>(emergencyActive);
  const [soloCercanos, setSoloCercanos] = useState<boolean>(false);

  const [modalFiltros, setModalFiltros] = useState(false);
  const [modalLista, setModalLista] = useState(false);
  const [modalPublicar, setModalPublicar] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);

  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [userFocusTrigger, setUserFocusTrigger] = useState(0);
  const [locating, setLocating] = useState(false);

  // La ubicación guardada en el perfil (BD/TanStack cache) manda siempre sobre la última lectura GPS:
  // así, si el vecino cambia su ubicación en el Perfil, el marcador se actualiza solo (sin presionar nada)
  // y el botón de precisión nunca "pisa" ese cambio con una posición vieja o simulada del emulador.
  const activeUserLocation: Coords | null = useMemo(
    () => (savedLocation ? { lat: savedLocation.lat, lng: savedLocation.lng } : userLocation),
    [savedLocation, userLocation],
  );

  const zona = zonas.find((z) => z.id === zoneId);
  // Los sectores (Miraflores, Chapayra, etc.) son solo centros poblados DENTRO del distrito de
  // Castilla, no zonas operativas propias: todo el contenido del barrio vive bajo Castilla, así
  // que el mapa siempre se centra ahí, sin importar qué sector haya elegido el vecino al registrarse.
  const center: Coords = CASTILLA_CENTER;
  const nombreCastilla = zonas.find((z) => z.name === 'Castilla')?.name ?? 'Castilla';

  // Los favores siempre se filtran por la zona asignada en la BD (seguridad de zonas), aunque la
  // ubicación marcada en el mapa esté lejos de Castilla. Avisamos al vecino en ese caso para que
  // no piense que el mapa está mostrando el lugar equivocado.
  const fueraDeZonaAsignada = Boolean(
    activeUserLocation &&
      distanceKm(activeUserLocation.lat, activeUserLocation.lng, center.lat, center.lng) >
        ZONE_MATCH_RADIUS_KM,
  );

  const ubicarmeEnMapa = async () => {
    if (locating) return;
    // Si ya hay una ubicación guardada en el perfil, es la fuente de verdad: solo centramos
    // el mapa en ella. No pedimos una lectura GPS en vivo que podría no coincidir (dispositivo
    // simulado, GPS desactualizado) con lo que el vecino acaba de guardar.
    if (savedLocation) {
      setUserFocusTrigger((n) => n + 1);
      return;
    }
    setLocating(true);
    try {
      const pos = await getRealPosition();
      if (pos.status === 'granted') {
        const approx = roundForReport({ lat: pos.lat, lng: pos.lng });
        // Si el GPS del emulador devuelve una coordenada fuera del barrio (> 10 km),
        // usamos el centro de la zona para mantener la experiencia coherente.
        const coords =
          distanceKm(approx.lat, approx.lng, center.lat, center.lng) <= 10 ? approx : center;
        setUserLocation(coords);
        setUserFocusTrigger((n) => n + 1);
      } else {
        setUserLocation(center);
        setUserFocusTrigger((n) => n + 1);
      }
    } catch {
      setUserLocation(center);
      setUserFocusTrigger((n) => n + 1);
    } finally {
      setLocating(false);
    }
  };

  // Mapeo unificado de Favores (pedir/ofrecer) + Oficios + Reportes de vulnerabilidad
  const allMapped = useMemo(() => {
    const seenCoords = new Map<string, number>();
    const normalizeCoord = (id: string, rawLat: number | null | undefined, rawLng: number | null | undefined, idx: number) => {
      let baseLat = rawLat ?? center.lat;
      let baseLng = rawLng ?? center.lng;
      const outOfZone =
        rawLat == null ||
        rawLng == null ||
        distanceKm(baseLat, baseLng, center.lat, center.lng) > ZONE_MATCH_RADIUS_KM;
      if (outOfZone) {
        const off = deterministicOffset(id, idx);
        baseLat = Number((center.lat + off.dLat * 2.4).toFixed(5));
        baseLng = Number((center.lng + off.dLng * 2.4).toFixed(5));
      } else {
        const key = `${baseLat.toFixed(4)},${baseLng.toFixed(4)}`;
        const count = seenCoords.get(key) ?? 0;
        seenCoords.set(key, count + 1);
        if (count > 0) {
          const off = deterministicOffset(id, count);
          baseLat = Number((baseLat + off.dLat).toFixed(5));
          baseLng = Number((baseLng + off.dLng).toFixed(5));
        }
      }
      return { lat: baseLat, lng: baseLng };
    };

    const calcDist = (lat: number, lng: number) =>
      activeUserLocation
        ? Math.round(distanceKm(activeUserLocation.lat, activeUserLocation.lng, lat, lng) * 1000)
        : null;

    const entries: MapEntry[] = [];

    // 1. Favores activos (Pedir y Ofrecer)
    const activeFavors = favores.filter((f) => f.status === 'abierta' || f.status === 'en_curso');
    activeFavors.forEach((f, idx) => {
      const kind = f.intent;
      const { lat, lng } = normalizeCoord(f.id, f.location?.lat, f.location?.lng, idx);
      entries.push({
        id: f.id,
        kind,
        title: f.title,
        subtitle: f.description ?? favorTypeLabel[f.type],
        categoryLabel: favorTypeLabel[f.type],
        authorName: f.author.fullName,
        createdAt: f.createdAt,
        urgency: f.urgency,
        favorType: f.type,
        icon: favorTypeIcon[f.type],
        distanceMeters: calcDist(lat, lng),
        favor: f,
        point: {
          id: f.id,
          lat,
          lng,
          kind,
          label: f.title.length > 52 ? `${f.title.slice(0, 52)}…` : f.title,
          urgency: f.urgency,
          type: f.type,
          authorName: f.author.fullName,
        },
      });
    });

    // 2. Capa de Oficios del barrio (si está activa o si se filtró por 'oficio')
    if (mostrarCapaOficios || filtroIntencion === 'oficio') {
      oficios.forEach((prof, idx) => {
        const entryId = `oficio:${prof.id}`;
        const { lat, lng } = normalizeCoord(
          entryId,
          prof.location?.lat,
          prof.location?.lng,
          idx + 30,
        );
        const label = `${prof.oficio.name}: ${prof.user.fullName}`;
        entries.push({
          id: entryId,
          kind: 'oficio',
          title: `${prof.user.fullName} · ${prof.oficio.name}`,
          subtitle: prof.description || 'Vecino de oficio validado en el barrio',
          categoryLabel: `Oficio · ${prof.validatedCount} validaciones`,
          authorName: prof.user.fullName,
          icon: 'construct-outline',
          distanceMeters: calcDist(lat, lng),
          profile: prof,
          point: {
            id: entryId,
            lat,
            lng,
            kind: 'oficio',
            label: label.length > 52 ? `${label.slice(0, 52)}…` : label,
            oficioCategory: prof.oficio.category,
            authorName: prof.user.fullName,
          },
        });
      });
    }

    // 3. Capa de Alertas / Reportes de vulnerabilidad (si está activa o si se filtró por 'emergencia')
    if (mostrarCapaAlertas || filtroIntencion === 'emergencia') {
      const activeReports = reportes.filter((r) => r.status === 'activo');
      activeReports.forEach((rep, idx) => {
        const entryId = `reporte:${rep.id}`;
        const { lat, lng } = normalizeCoord(entryId, rep.approxLat, rep.approxLng, idx + 60);
        const needsTxt =
          rep.needs.length > 0
            ? `Necesita: ${rep.needs.map((n) => resourceLabel[n]).join(', ')}`
            : 'Reporte comunitario';
        entries.push({
          id: entryId,
          kind: 'emergencia',
          title: rep.description,
          subtitle: needsTxt,
          categoryLabel: needsTxt,
          authorName: rep.reporterName ?? 'Vecino anónimo',
          createdAt: rep.createdAt,
          urgency: 'emergencia',
          icon: 'warning-outline',
          distanceMeters: calcDist(lat, lng),
          report: rep,
          point: {
            id: entryId,
            lat,
            lng,
            kind: 'emergencia',
            label: rep.description.length > 52 ? `${rep.description.slice(0, 52)}…` : rep.description,
            urgency: 'emergencia',
          },
        });
      });
    }

    return entries;
  }, [
    favores,
    oficios,
    reportes,
    mostrarCapaOficios,
    mostrarCapaAlertas,
    filtroIntencion,
    center.lat,
    center.lng,
    activeUserLocation,
  ]);

  const totalPedidos = useMemo(
    () => allMapped.filter((x) => x.kind === 'pedir').length,
    [allMapped],
  );
  const totalOfrecidos = useMemo(
    () => allMapped.filter((x) => x.kind === 'ofrecer').length,
    [allMapped],
  );
  const totalFavores = totalPedidos + totalOfrecidos;

  const filteredItems = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const list = allMapped.filter((entry) => {
      if (filtroIntencion !== 'todos' && entry.kind !== filtroIntencion) return false;
      if (filtroCategoria && entry.favorType !== filtroCategoria) return false;
      if (filtroUrgencia && entry.urgency !== filtroUrgencia) return false;
      if (soloCercanos && entry.distanceMeters != null && entry.distanceMeters > 700) return false;
      if (q) {
        const matchTitle = entry.title.toLowerCase().includes(q);
        const matchSub = entry.subtitle.toLowerCase().includes(q);
        const matchAuthor = entry.authorName.toLowerCase().includes(q);
        const matchCat = entry.categoryLabel.toLowerCase().includes(q);
        if (!matchTitle && !matchSub && !matchAuthor && !matchCat) return false;
      }
      return true;
    });

    if (activeUserLocation) {
      return [...list].sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));
    }
    return list;
  }, [allMapped, busqueda, filtroIntencion, filtroCategoria, filtroUrgencia, soloCercanos, activeUserLocation]);

  const points = useMemo(() => filteredItems.map((x) => x.point), [filteredItems]);

  const selectedIndex = useMemo(
    () => (selectedId ? filteredItems.findIndex((x) => x.id === selectedId) : -1),
    [filteredItems, selectedId],
  );
  const selectedEntry = selectedIndex >= 0 ? filteredItems[selectedIndex] : null;

  const activeFilterCount =
    (filtroIntencion !== 'todos' ? 1 : 0) +
    (filtroCategoria ? 1 : 0) +
    (filtroUrgencia ? 1 : 0) +
    (mostrarCapaOficios ? 1 : 0) +
    (mostrarCapaAlertas ? 1 : 0) +
    (soloCercanos ? 1 : 0) +
    (busqueda.trim() ? 1 : 0);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroIntencion('todos');
    setFiltroCategoria(undefined);
    setFiltroUrgencia(undefined);
    setMostrarCapaOficios(false);
    setMostrarCapaAlertas(false);
    setSoloCercanos(false);
    setSelectedId(null);
    setFitTrigger((n) => n + 1);
  };

  const irAnteriorPunto = () => {
    if (filteredItems.length === 0) return;
    const prevIdx = selectedIndex <= 0 ? filteredItems.length - 1 : selectedIndex - 1;
    setSelectedId(filteredItems[prevIdx].id);
  };

  const irSiguientePunto = () => {
    if (filteredItems.length === 0) return;
    const nextIdx = selectedIndex < 0 || selectedIndex >= filteredItems.length - 1 ? 0 : selectedIndex + 1;
    setSelectedId(filteredItems[nextIdx].id);
  };

  const abrirDetalleEntry = (entry: MapEntry) => {
    if (entry.favor) {
      if (entry.favor.syncStatus !== 'enviado') return;
      router.push(`/favores/${entry.favor.id}`);
      return;
    }
    if (entry.profile) {
      router.push(`/oficio/${entry.profile.id}`);
      return;
    }
    if (entry.report) {
      router.push('/emergencia');
    }
  };

  const badgeConfig = (kind: MapEntry['kind']) => {
    if (kind === 'ofrecer') {
      return { bg: colors.naranjaSuave, dot: colors.naranja, fg: colors.azul, text: 'Ofrece ayuda' };
    }
    if (kind === 'oficio') {
      return { bg: colors.verdeExitoSuave, dot: colors.verdeExito, fg: colors.verdeExito, text: 'Oficio vecinal' };
    }
    if (kind === 'emergencia') {
      return { bg: colors.rojoSuave, dot: colors.rojo, fg: colors.rojo, text: 'Alerta comunitaria' };
    }
    return { bg: colors.azulSuave, dot: colors.azul, fg: colors.azul, text: 'Pide ayuda' };
  };

  return (
    <Screen scroll={false}>
      {/* CABECERA COMPACTA Y RESPONSIVA */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.titulo, { color: p.text }]}>Mapa del barrio</Text>
          <Text style={[styles.sub, { color: p.muted }]} numberOfLines={1}>
            {zona?.name ? `Zona ${zona.name} · ` : ''}
            {filteredItems.length} punto{filteredItems.length === 1 ? '' : 's'} en el mapa
            {activeUserLocation ? ' · Ordenados por cercanía' : ''}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {!isWide ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver resultados en lista"
              onPress={() => setModalLista(true)}
              style={[styles.topActionBtn, { backgroundColor: colors.blanco, borderColor: p.border }]}
            >
              <Ionicons name="list-outline" size={18} color={colors.azul} />
              <Text style={styles.topActionText}>Lista ({filteredItems.length})</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Publicar en el mapa"
            onPress={() => setModalPublicar(true)}
            style={[styles.topActionBtn, { backgroundColor: p.cta, borderColor: p.cta }]}
          >
            <Ionicons name="add-circle-outline" size={18} color={p.ctaText} />
            <Text style={[styles.topActionText, { color: p.ctaText }]}>Publicar</Text>
          </Pressable>
        </View>
      </View>

      {fueraDeZonaAsignada ? (
        <View style={styles.zoneNotice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.azul} />
          <Text style={[styles.zoneNoticeText, { color: colors.azul }]}>
            Tu ubicación marcada está fuera de {nombreCastilla}. Estás viendo los favores de tu zona asignada.
          </Text>
        </View>
      ) : null}

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
        <View style={[styles.mainLayout, isWide && styles.mainLayoutWide]}>
          {/* PANEL LATERAL FIJO EN WEB / PANTALLAS ANCHAS (Split-View) */}
          {isWide ? (
            <View style={[styles.sidePanel, { borderColor: p.border }]}>
              <View style={styles.sidePanelSearchRow}>
                <View style={[styles.searchBox, { borderColor: p.border, flex: 1 }]}>
                  <Ionicons name="search-outline" size={18} color={colors.gris} />
                  <TextInput
                    value={busqueda}
                    onChangeText={(txt) => {
                      setBusqueda(txt);
                      setSelectedId(null);
                    }}
                    placeholder="Buscar herramienta, vecino, oficio..."
                    placeholderTextColor={colors.gris}
                    style={[styles.searchInput, { color: p.text }]}
                  />
                  {busqueda.length > 0 ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" onPress={() => setBusqueda('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={colors.gris} />
                    </Pressable>
                  ) : null}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Abrir filtros avanzados"
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

              {/* Selector de capas comunitarias en el panel lateral */}
              <View style={styles.sideCapasRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setMostrarCapaOficios((v) => !v)}
                  style={[
                    styles.capaChip,
                    mostrarCapaOficios ? styles.capaChipActiveGreen : styles.capaChipIdle,
                  ]}
                >
                  <Ionicons
                    name="construct-outline"
                    size={15}
                    color={mostrarCapaOficios ? colors.blanco : colors.verdeExito}
                  />
                  <Text
                    style={[
                      styles.capaChipText,
                      { color: mostrarCapaOficios ? colors.blanco : colors.azul },
                    ]}
                  >
                    Oficios ({oficios.length})
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setMostrarCapaAlertas((v: boolean) => !v)}
                  style={[
                    styles.capaChip,
                    mostrarCapaAlertas ? styles.capaChipActiveRed : styles.capaChipIdle,
                  ]}
                >
                  <Ionicons
                    name="warning-outline"
                    size={15}
                    color={mostrarCapaAlertas ? colors.blanco : colors.rojo}
                  />
                  <Text
                    style={[
                      styles.capaChipText,
                      { color: mostrarCapaAlertas ? colors.blanco : colors.azul },
                    ]}
                  >
                    Alertas ({reportes.filter((r) => r.status === 'activo').length})
                  </Text>
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.sideListScroll}>
                {filteredItems.length === 0 ? (
                  <View style={styles.emptySideBox}>
                    <Ionicons name="map-outline" size={32} color={colors.gris} />
                    <Text style={[styles.emptyListText, { color: p.muted }]}>
                      No hay resultados con estos filtros.
                    </Text>
                    {activeFilterCount > 0 ? (
                      <AppButton
                        label="Restablecer filtros"
                        variant="secondary"
                        icon="refresh-outline"
                        onPress={limpiarFiltros}
                      />
                    ) : null}
                  </View>
                ) : (
                  filteredItems.map((entry) => {
                    const b = badgeConfig(entry.kind);
                    const isSel = selectedId === entry.id;
                    const distTxt = formatDistance(entry.distanceMeters);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={entry.id}
                        onPress={() => setSelectedId(entry.id)}
                        style={[
                          styles.sideCard,
                          {
                            borderColor: isSel ? colors.azul : p.border,
                            backgroundColor: isSel ? colors.azulSuave : colors.blanco,
                          },
                        ]}
                      >
                        <View style={styles.sideCardTop}>
                          <View style={[styles.previewKindBadge, { backgroundColor: b.bg }]}>
                            <View style={[styles.dot, { backgroundColor: b.dot }]} />
                            <Text style={[styles.previewKindText, { color: b.fg }]}>{b.text}</Text>
                          </View>
                          {distTxt ? (
                            <Text style={[styles.distBadgeText, { color: p.muted }]}>{distTxt}</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.listTitle, { color: p.text }]} numberOfLines={2}>
                          {entry.title}
                        </Text>
                        <Text style={[styles.listAuthor, { color: p.muted }]} numberOfLines={1}>
                          {entry.authorName}
                          {entry.createdAt ? ` · ${timeAgo(entry.createdAt)}` : ''}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          ) : null}

          {/* CONTENEDOR DEL MAPA ADAPTABLE (flex: 1 ocupa todo el alto disponible) */}
          <View style={styles.mapContainer}>
            <BarrioMap
              center={center}
              points={points}
              selectedId={selectedId}
              userLocation={activeUserLocation}
              userFocusTrigger={userFocusTrigger}
              fitTrigger={fitTrigger}
              onPointPress={(id, same) => {
                if (same) {
                  const found = filteredItems.find((x) => x.id === id);
                  if (found) abrirDetalleEntry(found);
                } else {
                  setSelectedId(id);
                }
              }}
              onMapClear={() => setSelectedId(null)}
            />

            {/* VENTANA FLOTANTE SUPERIOR: Buscador (en móvil) + Píldoras de filtro y capas */}
            <View style={styles.floatingTop} pointerEvents="box-none">
              {!isWide ? (
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
              ) : null}

              {/* Píldoras flotantes de intención y capas con iconos vectoriales */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.floatingPills}
              >
                <Pressable
                  accessibilityRole="button"
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
                  <Ionicons
                    name="layers-outline"
                    size={15}
                    color={filtroIntencion === 'todos' ? colors.blanco : colors.azul}
                  />
                  <Text
                    style={[
                      styles.pillText,
                      { color: filtroIntencion === 'todos' ? colors.blanco : colors.azul },
                    ]}
                  >
                    Todos ({totalFavores})
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
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
                    {totalPedidos} piden
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
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
                      {
                        backgroundColor:
                          filtroIntencion === 'ofrecer' ? colors.azul : colors.naranja,
                      },
                    ]}
                  />
                  <Text style={[styles.pillText, { color: colors.azul }]}>
                    {totalOfrecidos} ofrecen
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setMostrarCapaOficios((v) => !v);
                    setFitTrigger((n) => n + 1);
                  }}
                  style={[
                    styles.pillBtn,
                    mostrarCapaOficios ? styles.pillBtnActiveOficio : styles.pillBtnIdle,
                  ]}
                >
                  <Ionicons
                    name="construct-outline"
                    size={14}
                    color={mostrarCapaOficios ? colors.blanco : colors.verdeExito}
                  />
                  <Text
                    style={[
                      styles.pillText,
                      { color: mostrarCapaOficios ? colors.blanco : colors.azul },
                    ]}
                  >
                    Oficios ({oficios.length})
                  </Text>
                </Pressable>

                {filtroCategoria ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setFiltroCategoria(undefined)}
                    style={[styles.pillBtn, styles.pillBtnActiveTag]}
                  >
                    <Text style={[styles.pillText, { color: colors.azul }]}>
                      {favorTypeLabel[filtroCategoria]}
                    </Text>
                    <Ionicons name="close-circle" size={15} color={colors.azul} />
                  </Pressable>
                ) : null}

                {filtroUrgencia ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setFiltroUrgencia(undefined)}
                    style={[styles.pillBtn, styles.pillBtnActiveTag]}
                  >
                    <Text style={[styles.pillText, { color: colors.azul }]}>
                      {favorUrgencyLabel[filtroUrgencia]}
                    </Text>
                    <Ionicons name="close-circle" size={15} color={colors.azul} />
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>

            {/* BOTONES FLOTANTES LATERALES: Mi ubicación GPS, Encuadrar todo, Limpiar filtros */}
            <View
              style={[styles.floatingSide, isWide && { top: 60 }]}
              pointerEvents="box-none"
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Centrar en mi ubicación actual"
                onPress={ubicarmeEnMapa}
                style={[
                  styles.sideBtn,
                  activeUserLocation ? { backgroundColor: colors.azulSuave, borderColor: colors.azul } : null,
                ]}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={colors.azul} />
                ) : (
                  <Ionicons
                    name={activeUserLocation ? 'locate' : 'locate-outline'}
                    size={20}
                    color={colors.azul}
                  />
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Encuadrar todos los puntos visibles"
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

            {/* VENTANA FLOTANTE INFERIOR: Vista previa con navegación < Anterior / Siguiente > */}
            {selectedEntry ? (
              <View style={[styles.previewCard, isWide && styles.previewCardWide]}>
                <View style={styles.previewHeader}>
                  {(() => {
                    const b = badgeConfig(selectedEntry.kind);
                    return (
                      <View style={[styles.previewKindBadge, { backgroundColor: b.bg }]}>
                        <View style={[styles.dot, { backgroundColor: b.dot }]} />
                        <Text style={[styles.previewKindText, { color: b.fg }]}>{b.text}</Text>
                      </View>
                    );
                  })()}

                  {selectedEntry.urgency ? (
                    <UrgencyBadge urgency={selectedEntry.urgency} />
                  ) : null}

                  {selectedEntry.distanceMeters != null ? (
                    <View style={styles.distancePill}>
                      <Ionicons name="walk-outline" size={13} color={colors.azul} />
                      <Text style={styles.distancePillText}>
                        {formatDistance(selectedEntry.distanceMeters)}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.previewNavGroup}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Punto anterior"
                      onPress={irAnteriorPunto}
                      hitSlop={6}
                      style={styles.navIconBtn}
                    >
                      <Ionicons name="chevron-back" size={18} color={colors.azul} />
                    </Pressable>
                    <Text style={[styles.navCounter, { color: p.muted }]}>
                      {selectedIndex + 1}/{filteredItems.length}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Punto siguiente"
                      onPress={irSiguientePunto}
                      hitSlop={6}
                      style={styles.navIconBtn}
                    >
                      <Ionicons name="chevron-forward" size={18} color={colors.azul} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Cerrar vista previa"
                      onPress={() => setSelectedId(null)}
                      hitSlop={8}
                      style={[styles.navIconBtn, { marginLeft: 2 }]}
                    >
                      <Ionicons name="close" size={18} color={colors.gris} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.previewBody}>
                  <View style={[styles.previewIcon, { backgroundColor: p.highlight }]}>
                    <Ionicons name={selectedEntry.icon} size={22} color={colors.azul} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewCategory, { color: p.muted }]}>
                      {selectedEntry.categoryLabel}
                    </Text>
                    <Text style={[styles.previewTitle, { color: p.text }]} numberOfLines={2}>
                      {selectedEntry.title}
                    </Text>
                    {selectedEntry.subtitle ? (
                      <Text style={[styles.previewSubtitle, { color: p.text }]} numberOfLines={3}>
                        {selectedEntry.subtitle}
                      </Text>
                    ) : null}
                    <Text style={[styles.previewMeta, { color: p.muted }]} numberOfLines={1}>
                      {selectedEntry.authorName}
                      {selectedEntry.createdAt ? ` · ${timeAgo(selectedEntry.createdAt)}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={[styles.previewActions, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  {selectedEntry.favor ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Abrir chat con este vecino"
                      onPress={() => abrirChat(selectedEntry)}
                      style={({ pressed }) => [styles.chatBubble, pressed && { opacity: 0.85 }]}
                    >
                      <Ionicons name="chatbubble-ellipses" size={22} color={colors.blanco} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => abrirDetalleEntry(selectedEntry)}
                    style={[styles.previewPrimaryBtn, { backgroundColor: p.cta, flex: 1 }]}
                  >
                    <Text style={[styles.previewPrimaryText, { color: p.ctaText }]}>
                      {selectedEntry.kind === 'oficio'
                        ? 'Ver perfil del oficio'
                        : selectedEntry.kind === 'emergencia'
                          ? 'Ver panel de emergencia'
                          : 'Ver detalle del favor'}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color={p.ctaText} />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* VENTANA FLOTANTE / MODAL DE FILTROS PRECISOS Y CAPAS */}
      <Modal
        visible={modalFiltros}
        transparent
        animationType="fade"
        onRequestClose={() => setModalFiltros(false)}
      >
        <Pressable accessibilityRole="button" style={styles.modalOverlay} onPress={() => setModalFiltros(false)}>
          <Pressable onPress={() => {}} style={styles.floatingSheet}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: p.text }]}>Filtros y capas del mapa</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setModalFiltros(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={26} color={colors.gris} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.filterSectionTitle, { color: p.text }]}>
                1. Tipo de publicación
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
                2. Capas adicionales del barrio
              </Text>
              <View style={styles.chipWrap}>
                <Chip
                  label={`Técnicos y oficios (${oficios.length})`}
                  selected={mostrarCapaOficios}
                  onPress={() => setMostrarCapaOficios((v) => !v)}
                />
                <Chip
                  label={`Alertas comunitarias (${reportes.filter((r) => r.status === 'activo').length})`}
                  selected={mostrarCapaAlertas}
                  onPress={() => setMostrarCapaAlertas((v: boolean) => !v)}
                />
                {activeUserLocation ? (
                  <Chip
                    label="A menos de 700 m de mí"
                    selected={soloCercanos}
                    onPress={() => setSoloCercanos((v) => !v)}
                  />
                ) : null}
              </View>

              <Text style={[styles.filterSectionTitle, { color: p.text }]}>
                3. Categoría del favor
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
                4. Nivel de urgencia
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

      {/* VENTANA FLOTANTE DE RESULTADOS EN LISTA RÁPIDA (Móvil) */}
      <Modal
        visible={modalLista}
        transparent
        animationType="fade"
        onRequestClose={() => setModalLista(false)}
      >
        <Pressable accessibilityRole="button" style={styles.modalOverlay} onPress={() => setModalLista(false)}>
          <Pressable onPress={() => {}} style={styles.floatingSheet}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: p.text }]}>
                Puntos en el mapa ({filteredItems.length})
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setModalLista(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={26} color={colors.gris} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {filteredItems.length === 0 ? (
                <Text style={[styles.emptyListText, { color: p.muted }]}>
                  No hay puntos que coincidan con tus filtros actuales.
                </Text>
              ) : (
                filteredItems.map((entry) => {
                  const b = badgeConfig(entry.kind);
                  const distTxt = formatDistance(entry.distanceMeters);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={entry.id}
                      onPress={() => {
                        setSelectedId(entry.id);
                        setModalLista(false);
                      }}
                      style={[styles.listRow, { borderColor: p.border }]}
                    >
                      <View style={[styles.listDot, { backgroundColor: b.dot }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.listKind, { color: p.muted }]}>
                          {b.text} · {entry.categoryLabel}
                          {distTxt ? ` · ${distTxt}` : ''}
                        </Text>
                        <Text style={[styles.listTitle, { color: p.text }]} numberOfLines={2}>
                          {entry.title}
                        </Text>
                        <Text style={[styles.listAuthor, { color: p.muted }]}>
                          {entry.authorName}
                          {entry.createdAt ? ` · ${timeAgo(entry.createdAt)}` : ''}
                        </Text>
                      </View>
                      <Ionicons name="locate-outline" size={20} color={colors.azul} />
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* VENTANA FLOTANTE PARA PUBLICAR DIRECTAMENTE DESDE EL MAPA */}
      <Modal
        visible={modalPublicar}
        transparent
        animationType="fade"
        onRequestClose={() => setModalPublicar(false)}
      >
        <Pressable accessibilityRole="button" style={styles.modalOverlay} onPress={() => setModalPublicar(false)}>
          <Pressable onPress={() => {}} style={styles.floatingSheet}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: p.text }]}>¿Qué deseas publicar en el mapa?</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setModalPublicar(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={26} color={colors.gris} />
              </Pressable>
            </View>
            <Text style={[styles.publishSub, { color: p.muted }]}>
              Tu publicación aparecerá ubicada aproximadamente en tu zona para que tus vecinos puedan encontrarla.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setModalPublicar(false);
                router.push('/favores/nuevo?modo=pedir');
              }}
              style={[styles.publishOptionCard, { borderColor: colors.azul, backgroundColor: colors.azulSuave }]}
            >
              <View style={[styles.publishIconCircle, { backgroundColor: colors.azul }]}>
                <Ionicons name="hand-left-outline" size={22} color={colors.blanco} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.publishOptionTitle, { color: colors.azul }]}>Pedir un favor</Text>
                <Text style={[styles.publishOptionDesc, { color: p.body }]}>
                  Solicita prestada una herramienta, apoyo temporal o traslado solidario.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.azul} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setModalPublicar(false);
                router.push('/favores/nuevo?modo=ofrecer');
              }}
              style={[styles.publishOptionCard, { borderColor: colors.naranja, backgroundColor: colors.naranjaClaro }]}
            >
              <View style={[styles.publishIconCircle, { backgroundColor: colors.naranja }]}>
                <Ionicons name="heart-outline" size={22} color={colors.azul} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.publishOptionTitle, { color: colors.azul }]}>Ofrecer ayuda</Text>
                <Text style={[styles.publishOptionDesc, { color: p.body }]}>
                  Comparte materiales, presta herramientas o enseña una habilidad a tus vecinos.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.azul} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
