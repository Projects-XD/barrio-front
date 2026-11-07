import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';
import { logger } from '@/utils/logger';

interface ZoneOption {
  id: string;
  name: string;
}

const DEFAULT_ZONES: ZoneOption[] = [];

export default function Register() {
  const p = usePalette();
  const setSession = useAppStore((s) => s.setSession);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [zonas, setZonas] = useState<ZoneOption[]>(DEFAULT_ZONES);
  const [zonaSeleccionada, setZonaSeleccionada] = useState<ZoneOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'denied'>('idle');

  // Cargar lista de zonas directamente desde Supabase si están disponibles
  useEffect(() => {
    async function loadZones() {
      try {
        const { data, error } = await supabase.from('zones').select('id, name').order('name');
        if (error) {
          logger.warn('AUTH_REGISTER', `No se pudieron cargar zonas de Supabase: ${error.message}`);
        } else if (data && data.length > 0) {
          setZonas(data as ZoneOption[]);
          setZonaSeleccionada(null);
          logger.debug('AUTH_REGISTER', `Zonas cargadas desde Supabase (${data.length})`);
        }
      } catch (err: any) {
        logger.warn('AUTH_REGISTER', 'Excepción cargando zonas, usando fallback estático', err);
      }
    }
    loadZones();
  }, []);

  const normalizeText = (text: string) =>
    text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const detectZone = async () => {
    setLocStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocStatus('denied');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const haystack = normalizeText([place?.district, place?.subregion, place?.city, place?.name].filter(Boolean).join(' '));
      const match = zonas.find((z) => haystack.includes(normalizeText(z.name)));
      if (match) {
        setZonaSeleccionada(match);
        setLocStatus('found');
      } else {
        setLocStatus('notfound');
      }
    } catch (err: any) {
      logger.warn('AUTH_REGISTER', 'No se pudo detectar la ubicacion', err);
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
          logger.error('AUTH_LOGIN', `Error retornado por supabase.auth.signInWithPassword para ${cleanEmail}`, error);
          throw error;
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
          const { data: dbUser } = await supabase
            .from('users')
            .select('full_name, zone_id')
            .eq('id', data.user.id)
            .maybeSingle();

          if (dbUser?.zone_id) userZoneId = dbUser.zone_id;
          if (dbUser?.full_name) userFullName = dbUser.full_name;
        } catch (dbErr: any) {
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
        logger.info('AUTH_REGISTER', `Iniciando registro para: ${cleanEmail}`, {
          nombre: nombre.trim(),
          zone_id: zonaSeleccionada?.id,
        });

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: nombre.trim(),
              zone_id: zonaSeleccionada?.id,
            },
          },
        });

        // REQUISITO CRÍTICO: Si Supabase devuelve error, arrojarlo explícitamente para detener el flujo
        if (error) {
          logger.error('AUTH_REGISTER', `Error devuelto por supabase.auth.signUp para ${cleanEmail}`, error);
          throw error;
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
          // Asegurar que el registro en public.users exista
          try {
            await supabase.from('users').upsert({
              id: data.user.id,
              full_name: nombre.trim(),
              zone_id: zonaSeleccionada?.id,
              status: 'active',
            });
            logger.debug('AUTH_REGISTER', `Registro en public.users asegurado para ${data.user.id}`);
          } catch (upsertErr: any) {
            logger.warn('AUTH_REGISTER', 'Aviso al insertar en public.users (será manejado por el trigger SQL)', upsertErr);
          }

          setSession({
            token: data.session.access_token,
            userId: data.user.id,
            zoneId: zonaSeleccionada?.id ?? '',
            userFullName: nombre.trim(),
            userEmail: cleanEmail,
          });

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
    } catch (err: any) {
      const msg = err.message || 'Ocurrió un error inesperado al autenticar.';
      logger.error('AUTH_ERROR', `Fallo capturado en autenticación (${mode}) para ${cleanEmail}`, {
        error: err,
        message: msg,
      });
      setErrorMsg(msg);
      Alert.alert('Error de Autenticación', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen scroll={true}>
      <View style={styles.container}>
        <View style={styles.header}>
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
              setMode('login');
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
              setMode('register');
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

        <View style={styles.form}>
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
            style={[
              styles.input,
              { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
            ]}
          />

          <Text style={[styles.label, { color: p.text }]}>Contraseña</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={colors.gris}
            secureTextEntry
            style={[
              styles.input,
              { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
            ]}
          />

          {mode === 'register' ? (
            <>
              <Text style={[styles.label, { color: p.text }]}>Tu zona o barrio</Text>
              <AppButton
                label={locStatus === 'loading' ? 'Buscando tu ubicaciÃ³n...' : 'Usar mi ubicaciÃ³n'}
                variant="secondary"
                onPress={detectZone}
                disabled={locStatus === 'loading'}
              />
              {locStatus === 'found' ? (
                <Text style={[styles.privacyNote, { color: p.primary }]}>Detectamos tu zona: {zonaSeleccionada?.name}. Tu ubicaciÃ³n exacta no se guarda.</Text>
              ) : null}
              {locStatus === 'denied' ? (
                <Text style={[styles.privacyNote, { color: p.muted }]}>Sin permiso de ubicaciÃ³n. Elige tu zona abajo.</Text>
              ) : null}
              {locStatus === 'notfound' ? (
                <Text style={[styles.privacyNote, { color: p.muted }]}>No pudimos detectar tu zona. Elige tu zona abajo.</Text>
              ) : null}
              <View style={styles.chips}>
                {zonas.map((z) => (
                  <Chip
                    key={z.id}
                    label={z.name}
                    selected={zonaSeleccionada?.id === z.id}
                    onPress={() => setZonaSeleccionada(z)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  header: {
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  titulo: {
    fontSize: 28,
    fontFamily: fonts.bold,
    marginBottom: 6,
  },
  sub: {
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 22,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
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
    fontSize: 13,
    fontFamily: fonts.regular,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  loadingContainer: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
