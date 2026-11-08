import { useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { distanceKm, getRealPosition, normalizeText, openLocationSettings, placeTexts } from '@/utils/location';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { MapPicker, type MapPickerHandle } from '@/components/MapPicker';
import { Screen } from '@/components/Screen';
import { useZones } from '@/hooks/useData';
import { usePalette } from '@/hooks/usePalette';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';
import { CASTILLA_BOUNDS, CASTILLA_CENTER, isWithinCastilla, type Coords } from '@/utils/geo';
import { logger } from '@/utils/logger';

interface ZoneOption {
  id: string;
  name: string;
  center_lat?: number | null;
  center_lng?: number | null;
}

function formatAuthError(err: unknown): { userMessage: string; isExpected: boolean } {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code).toLowerCase() : '';
  const lower = raw.toLowerCase();

  if (
    code === 'invalid_credentials' ||
    lower.includes('invalid login credentials') ||
    lower.includes('invalid grant') ||
    lower.includes('invalid password') ||
    lower.includes('invalid credentials')
  ) {
    return {
      userMessage: 'Correo o contraseña incorrectos. Por favor, verifica tus datos e inténtalo de nuevo.',
      isExpected: true,
    };
  }

  if (lower.includes('email not confirmed')) {
    return {
      userMessage: 'Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada para verificarlo.',
      isExpected: true,
    };
  }

  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return {
      userMessage: 'Ya existe una cuenta con este correo. Puedes ingresar en "Iniciar sesión".',
      isExpected: true,
    };
  }

  if (lower.includes('password should be at least')) {
    return {
      userMessage: 'La contraseña debe tener al menos 6 caracteres.',
      isExpected: true,
    };
  }

  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return {
      userMessage: 'Demasiados intentos seguidos. Por favor, espera unos momentos antes de volver a intentar.',
      isExpected: true,
    };
  }

  return {
    userMessage: raw || 'Ocurrió un error al autenticar. Por favor, intenta de nuevo.',
    isExpected: false,
  };
}

export default function Register() {
  const p = usePalette();
  const setSession = useAppStore((s) => s.setSession);
  const mapRef = useRef<MapPickerHandle>(null);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  // Desliza el formulario desde la derecha al ir a registro, y desde la izquierda al ir a login.
  const [slide] = useState(() => new Animated.Value(0));
  const switchMode = (next: 'login' | 'register') => {
    if (next === mode) return;
    slide.setValue(next === 'register' ? 48 : -48);
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 9, tension: 70 }).start();
    setMode(next);
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [nombre, setNombre] = useState('');
  // Las zonas vienen del backend (/zones): con RLS activo, la clave anon no puede leer la tabla.
  const zonesQuery = useZones();
  const zonas: ZoneOption[] = useMemo(() => zonesQuery.data ?? [], [zonesQuery.data]);
  const [zonaSeleccionada, setZonaSeleccionada] = useState<ZoneOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'found' | 'outside' | 'notfound' | 'denied'>('idle');
  const [ubicacionRegistro, setUbicacionRegistro] = useState<Coords | null>(null);

  const mapZones = useMemo(
    () =>
      zonas
        .filter((z) => z.center_lat != null && z.center_lng != null)
        .map((z) => ({
          id: z.id,
          name: z.name,
          lat: z.center_lat as number,
          lng: z.center_lng as number,
        })),
    [zonas],
  );

  const handleMapChange = (c: Coords, zoneId?: string) => {
    setUbicacionRegistro(c);
    if (zoneId) {
      const direct = zonas.find((z) => z.id === zoneId);
      if (direct) {
        setZonaSeleccionada(direct);
        return;
      }
    }
    const conCoords = zonas.filter((z) => z.center_lat != null && z.center_lng != null);
    if (conCoords.length === 0) return;
    const closest = conCoords.reduce<{ zona: ZoneOption; km: number } | null>((mejor, z) => {
      const km = distanceKm(c.lat, c.lng, z.center_lat as number, z.center_lng as number);
      return !mejor || km < mejor.km ? { zona: z, km } : mejor;
    }, null);
    if (closest) {
      setZonaSeleccionada(closest.zona);
    }
  };

  const handleChipSelect = (z: ZoneOption) => {
    setZonaSeleccionada(z);
    if (z.center_lat != null && z.center_lng != null) {
      mapRef.current?.setPoint({ lat: z.center_lat, lng: z.center_lng });
    }
  };

  const detectZone = async () => {
    setLocStatus('loading');
    try {
      const pos = await getRealPosition();
      if (pos.status === 'denied') {
        setLocStatus('denied');
        return;
      }
      const coords: Coords = { lat: pos.lat, lng: pos.lng };
      setUbicacionRegistro(coords);
      const texts = await placeTexts(pos.lat, pos.lng);
      // Solo aceptamos ubicaciones dentro de Castilla
      const enCastilla = isWithinCastilla(coords) || texts.some((t) => t.includes('castilla'));
      if (!enCastilla) {
        setLocStatus('outside');
        return;
      }
      // Preferimos el centro poblado más cercano a las coordenadas reales del vecino.
      const conCoords = zonas.filter((z) => z.center_lat != null && z.center_lng != null);
      const cercana = conCoords.reduce<{ zona: ZoneOption; km: number } | null>((mejor, z) => {
        const km = distanceKm(pos.lat, pos.lng, z.center_lat as number, z.center_lng as number);
        return !mejor || km < mejor.km ? { zona: z, km } : mejor;
      }, null);
      const exacta = zonas.find((z) => texts.some((t) => t.includes(normalizeText(z.name))));
      const match = cercana?.zona ?? exacta ?? zonas.find((z) => normalizeText(z.name) === 'castilla');
      if (match) {
        setZonaSeleccionada(match);
        setLocStatus('found');
        mapRef.current?.setPoint(coords);
      } else {
        setLocStatus('outside');
      }
    } catch (err: unknown) {
      logger.warn('AUTH_REGISTER', 'No se pudo obtener la ubicación', err);
      setLocStatus('notfound');
    }
  };

  const isValidEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());

  const canSubmit =
    isValidEmail(email) &&
    password.length >= 6 &&
    (mode === 'login' || (mode === 'register' && nombre.trim().length >= 2 && zonaSeleccionada !== null));

  const handleSubmit = async () => {
    if (!canSubmit || isLoading) return;
    if (mode === 'register' && !zonaSeleccionada) return;
    setIsLoading(true);
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (mode === 'login') {
        logger.info('AUTH_LOGIN', `Iniciando sesión para: ${cleanEmail}`);
        // 1. Iniciar sesión directamente contra Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          const { userMessage, isExpected } = formatAuthError(error);
          if (isExpected) {
            logger.warn('AUTH_LOGIN', `Intento de acceso no exitoso para ${cleanEmail}: ${error.message}`);
          } else {
            logger.error('AUTH_LOGIN', `Error retornado por supabase.auth.signInWithPassword para ${cleanEmail}`, error);
          }
          setErrorMsg(userMessage);
          return;
        }

        if (!data.session || !data.user) {
          const sessionErr = new Error('No se pudo establecer la sesión del usuario.');
          logger.error('AUTH_LOGIN', 'supabase.auth.signInWithPassword no devolvió sesión válida', { data });
          throw sessionErr;
        }

        // Obtener zone_id asignado al usuario
        let userZoneId = data.user.user_metadata?.zone_id as string | undefined;
        let userFullName = (data.user.user_metadata?.full_name as string) || cleanEmail.split('@')[0];

        try {
          const { data: dbUser, error: dbReadError } = await supabase
            .from('users')
            .select('full_name, zone_id')
            .eq('id', data.user.id)
            .maybeSingle();

          // supabase-js devuelve el fallo en `error` sin lanzarlo: hay que propagarlo para que el aviso salga.
          if (dbReadError) throw dbReadError;
          if (dbUser?.zone_id) userZoneId = dbUser.zone_id;
          if (dbUser?.full_name) userFullName = dbUser.full_name;
        } catch (dbErr: unknown) {
          logger.warn('AUTH_LOGIN', 'No se pudo leer perfil desde public.users, usando metadata', dbErr);
        }

        const effectiveZoneId = userZoneId || zonaSeleccionada?.id || '';

        // Guardar sesión en el store
        setSession({
          token: data.session.access_token,
          userId: data.user.id,
          zoneId: effectiveZoneId,
          userFullName,
          userEmail: data.user.email,
        });

        logger.info('AUTH_LOGIN', `Sesión iniciada exitosamente para ${cleanEmail} en zona ${effectiveZoneId}`);
        router.replace('/(tabs)/inicio');
      } else {
        // 2. Registro de nuevo usuario contra Supabase Auth
        const regLat = ubicacionRegistro?.lat ?? zonaSeleccionada?.center_lat ?? CASTILLA_CENTER.lat;
        const regLng = ubicacionRegistro?.lng ?? zonaSeleccionada?.center_lng ?? CASTILLA_CENTER.lng;
        const regAddress =
          zonaSeleccionada?.name ? `${zonaSeleccionada.name}, Castilla` : 'Castilla, Piura';

        logger.info('AUTH_REGISTER', `Iniciando registro para: ${cleanEmail}`, {
          nombre: nombre.trim(),
          zone_id: zonaSeleccionada?.id,
          location: { lat: regLat, lng: regLng, address: regAddress },
        });

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: nombre.trim(),
              location_lat: regLat,
              location_lng: regLng,
              location_address: regAddress,
              zone_id: zonaSeleccionada?.id,
            },
          },
        });

        // REQUISITO CRÍTICO: Si Supabase devuelve error, procesarlo limpiamente
        if (error) {
          const { userMessage, isExpected } = formatAuthError(error);
          if (isExpected) {
            logger.warn('AUTH_REGISTER', `Aviso en registro para ${cleanEmail}: ${error.message}`);
          } else {
            logger.error('AUTH_REGISTER', `Error devuelto por supabase.auth.signUp para ${cleanEmail}`, error);
          }
          setErrorMsg(userMessage);
          return;
        }

        // Caso borde de Supabase: Si el usuario ya existe en Supabase y confirmación está activa,
        // Supabase no devuelve error pero data.user?.identities está vacío []
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          const duplicateErr = new Error('Este correo ya está registrado en Barrio. Por favor ingresa a la pestaña "Iniciar sesión".');
          logger.warn('AUTH_REGISTER', `Intento de registrar correo ya existente: ${cleanEmail}`);
          throw duplicateErr;
        }

        if (!data.user) {
          const noUserErr = new Error('No se pudo completar el registro de la cuenta.');
          logger.error('AUTH_REGISTER', 'supabase.auth.signUp retornó data sin usuario', { data });
          throw noUserErr;
        }

        logger.info('AUTH_REGISTER', `Usuario creado en auth.users con ID: ${data.user.id}`, {
          hasSession: Boolean(data.session),
        });

        // Si Supabase devuelve sesión inmediata (auto-confirm activo)
        if (data.session) {
          // public.users lo crea el trigger SQL handle_new_user (0002/0025); con RLS el cliente no
          // puede escribirlo. El trigger ignora el sector elegido aquí y asigna siempre la zona
          // Castilla: se relee la fila real en vez de reusar `zonaSeleccionada`, para no mandar al
          // backend un zone_id de sector que ya no coincide con el guardado y dispare un 403.
          let zoneId = zonaSeleccionada?.id ?? '';
          try {
            const { data: dbUser } = await supabase
              .from('users')
              .select('zone_id')
              .eq('id', data.user.id)
              .maybeSingle();
            if (dbUser?.zone_id) zoneId = dbUser.zone_id;
          } catch (dbErr: unknown) {
            logger.warn('AUTH_REGISTER', 'No se pudo leer la zona asignada desde public.users, usando el sector elegido', dbErr);
          }

          setSession({
            token: data.session.access_token,
            userId: data.user.id,
            zoneId,
            userFullName: nombre.trim(),
            userEmail: cleanEmail,
          });

          // Por si algo (ej. el interceptor de api/client.ts) ya disparó una petición con la
          // zona vieja mientras se resolvía la real: se descarta todo lo cacheado y se obliga a
          // reconsultar con la zona ya correcta antes de navegar al inicio. No se pre-calienta
          // mySavedLocation con zonaSeleccionada?.id: ese sector ya no es el zoneId real (todos
          // los vecinos quedan en Castilla), así que esa clave de caché sería incorrecta.
          queryClient.clear();
          await queryClient.invalidateQueries();

          logger.info('AUTH_REGISTER', `Registro completado y sesión establecida para ${cleanEmail}`);
          router.replace('/(tabs)/inicio');
        } else {
          // Si el proyecto requiere confirmar correo
          logger.info('AUTH_REGISTER', `Registro completado. Esperando confirmación de correo para ${cleanEmail}`);
          Alert.alert(
            '¡Cuenta creada!',
            'Revisa tu bandeja de entrada para verificar tu correo antes de ingresar.',
            [{ text: 'Entendido', onPress: () => setMode('login') }]
          );
        }
      }
    } catch (err: unknown) {
      const { userMessage, isExpected } = formatAuthError(err);
      if (isExpected) {
        logger.warn('AUTH_ERROR', `Aviso en autenticación (${mode}) para ${cleanEmail}: ${userMessage}`);
      } else {
        logger.error('AUTH_ERROR', `Fallo inesperado en autenticación (${mode}) para ${cleanEmail}`, {
          error: err,
          message: userMessage,
        });
      }
      setErrorMsg(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen scroll={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Image source={iconApp} style={styles.marca} accessibilityLabel="Barrio" />
          <Text style={[styles.titulo, { color: p.text }]}>
            {mode === 'login' ? 'Bienvenido a Barrio' : 'Únete a tu Barrio'}
          </Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            {mode === 'login'
              ? 'Ingresa tus credenciales para conectar con tu comunidad.'
              : 'Conéctate con tus vecinos de forma cercana, transparente y segura.'}
          </Text>
        </View>

        {/* Selector de modo Login / Registro */}
        <View style={[styles.tabContainer, { backgroundColor: colors.fondo, borderColor: colors.grisBorde, borderWidth: 1 }]}>
          <Pressable
            accessibilityRole="tab"
            onPress={() => {
              switchMode('login');
              setErrorMsg(null);
            }}
            style={[
              styles.tabButton,
              mode === 'login' && [styles.tabButtonActive, { backgroundColor: colors.blanco }],
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: mode === 'login' ? p.primary : p.muted },
                mode === 'login' && styles.tabTextActive,
              ]}
            >
              Iniciar sesión
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            onPress={() => {
              switchMode('register');
              setErrorMsg(null);
            }}
            style={[
              styles.tabButton,
              mode === 'register' && [styles.tabButtonActive, { backgroundColor: colors.blanco }],
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: mode === 'register' ? p.primary : p.muted },
                mode === 'register' && styles.tabTextActive,
              ]}
            >
              Crear cuenta
            </Text>
          </Pressable>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <Animated.View style={[styles.form, { transform: [{ translateX: slide }] }]}>
          {mode === 'register' ? (
            <>
              <Text style={[styles.label, { color: p.text }]}>Nombre y apellido</Text>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej. Alexander García"
                placeholderTextColor={colors.gris}
                autoCapitalize="words"
                style={[
                  styles.input,
                  { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
                ]}
              />
            </>
          ) : null}

          <Text style={[styles.label, { color: p.text }]}>Correo electrónico</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="vecino@ejemplo.com"
            placeholderTextColor={colors.gris}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            blurOnSubmit={false}
            style={[
              styles.input,
              { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
            ]}
          />

          <Text style={[styles.label, { color: p.text }]}>Contraseña</Text>
          <View style={styles.passwordRow}>
            <TextInput
              ref={passwordInputRef}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={colors.gris}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={canSubmit ? handleSubmit : undefined}
              style={[
                styles.input,
                styles.passwordInput,
                { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              style={[styles.eyeButton, { borderColor: p.border, backgroundColor: colors.blanco }]}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.azul} />
            </Pressable>
          </View>

          {mode === 'register' ? (
            <>
              <Text style={[styles.label, { color: p.text }]}>Tu zona o barrio de Castilla</Text>
              <Text style={[styles.helpText, { color: p.muted }]}>
                Elige tu lugar en el mapa delimitado a Castilla o toca uno de los badges abajo.
              </Text>

              <AppButton
                label={locStatus === 'loading' ? 'Buscando tu ubicación...' : 'Usar mi ubicación actual'}
                variant="secondary"
                icon="location-outline"
                onPress={detectZone}
                disabled={locStatus === 'loading'}
              />

              {locStatus === 'found' ? (
                <Text style={[styles.privacyNote, { color: p.primary }]}>
                  Detectamos tu zona: {zonaSeleccionada?.name}. Tu ubicación exacta no se guarda.
                </Text>
              ) : null}
              {locStatus === 'denied' ? (
                <>
                  <Text style={[styles.privacyNote, { color: p.muted }]}>
                    Sin permiso de ubicación. Puedes usar el mapa delimitado a Castilla o elegir tu zona abajo.
                  </Text>
                  <AppButton label="Abrir ajustes de ubicación" variant="link" onPress={openLocationSettings} />
                </>
              ) : null}
              {locStatus === 'outside' ? (
                <View style={styles.outsideNotice}>
                  <Ionicons name="location-outline" size={18} color={colors.naranja} />
                  <Text style={[styles.outsideNoticeText, { color: colors.azul }]}>
                    Tu ubicación actual no se encuentra en Castilla. Si no te encuentras en Castilla, puedes usar el mapa para buscar en Castilla.
                  </Text>
                </View>
              ) : null}
              {locStatus === 'notfound' ? (
                <View style={styles.outsideNotice}>
                  <Ionicons name="map-outline" size={18} color={colors.naranja} />
                  <Text style={[styles.outsideNoticeText, { color: colors.azul }]}>
                    Si no te encuentras en Castilla o no pudimos detectar tu ubicación, puedes usar el mapa para buscar en Castilla.
                  </Text>
                </View>
              ) : null}

              {/* Mapa interactivo delimitado al distrito de Castilla */}
              <View style={styles.mapWrap}>
                <MapPicker
                  ref={mapRef}
                  initial={
                    zonaSeleccionada?.center_lat != null && zonaSeleccionada?.center_lng != null
                      ? { lat: zonaSeleccionada.center_lat, lng: zonaSeleccionada.center_lng }
                      : CASTILLA_CENTER
                  }
                  height={220}
                  maxBounds={CASTILLA_BOUNDS}
                  minZoom={11}
                  maxZoom={18}
                  initialZoom={12}
                  zones={mapZones}
                  onChange={handleMapChange}
                />
                <View style={styles.mapBadge}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={colors.azul} />
                  <Text style={styles.mapBadgeText}>Distrito de Castilla</Text>
                </View>
              </View>

              <View style={styles.chips}>
                {zonas.map((z) => (
                  <Chip
                    key={z.id}
                    label={z.name}
                    selected={zonaSeleccionada?.id === z.id}
                    onPress={() => handleChipSelect(z)}
                  />
                ))}
              </View>
              {zonesQuery.isLoading ? (
                <Text style={[styles.privacyNote, { color: p.muted }]}>Cargando zonas...</Text>
              ) : null}
              {zonesQuery.isError ? (
                <>
                  <Text style={[styles.privacyNote, { color: colors.rojo }]}>
                    No pudimos cargar las zonas. Revisa que el servidor esté encendido.
                  </Text>
                  <AppButton label="Reintentar" variant="link" onPress={() => zonesQuery.refetch()} />
                </>
              ) : null}
            </>
          ) : null}
        </Animated.View>

        <View style={styles.footer}>
          <Text style={[styles.privacyNote, { color: p.muted }]}>
            Tus datos vecinales están protegidos mediante autenticación segura Supabase.
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={p.primary} />
            </View>
          ) : (
            <AppButton
              label={mode === 'login' ? 'Entrar a mi barrio' : 'Registrarme en el barrio'}
              variant="accent"
              onPress={handleSubmit}
              disabled={!canSubmit}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const iconApp = require('../../assets/brand/icon-app.png');

const styles = StyleSheet.create({
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  passwordInput: { flex: 1 },
  eyeButton: { width: 52, height: 52, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  marca: { width: 48, height: 48, borderRadius: 14, marginBottom: spacing.xs },
  container: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  header: {
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  titulo: {
    fontSize: 24,
    fontFamily: fonts.bold,
    marginBottom: 4,
  },
  sub: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabButtonActive: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  tabTextActive: {
    fontFamily: fonts.bold,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  form: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    marginBottom: 8,
    marginTop: spacing.xs,
  },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fonts.regular,
    marginBottom: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  footer: {
    marginTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  privacyNote: {
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  helpText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  outsideNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.naranjaSuave,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  outsideNoticeText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  mapWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    position: 'relative',
  },
  mapBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(19, 46, 102, 0.15)',
  },
  mapBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.azul,
  },
  loadingContainer: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
