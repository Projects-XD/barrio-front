import { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { getRealPosition, normalizeText, openLocationSettings, placeTexts } from '@/utils/location';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { useZones } from '@/hooks/useData';
import { usePalette } from '@/hooks/usePalette';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';
import { logger } from '@/utils/logger';

interface ZoneOption {
  id: string;
  name: string;
}

export default function Register() {
  const p = usePalette();
  const setSession = useAppStore((s) => s.setSession);

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
  const [nombre, setNombre] = useState('');
  // Las zonas vienen del backend (/zones): con RLS activo, la clave anon no puede leer la tabla.
  const zonesQuery = useZones();
  const zonas: ZoneOption[] = zonesQuery.data ?? [];
  const [zonaSeleccionada, setZonaSeleccionada] = useState<ZoneOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'denied'>('idle');

  const detectZone = async () => {
    setLocStatus('loading');
    try {
      const pos = await getRealPosition();
      if (pos.status === 'denied') {
        setLocStatus('denied');
        return;
      }
      const texts = await placeTexts(pos.lat, pos.lng);
      // Solo aceptamos ubicaciones dentro de Castilla; el resto se elige a mano.
      if (!texts.some((t) => t.includes('castilla'))) {
        setLocStatus('notfound');
        return;
      }
      const exacta = zonas.find((z) => texts.some((t) => t.includes(normalizeText(z.name))));
      const match = exacta ?? zonas.find((z) => normalizeText(z.name) === 'castilla');
      if (match) {
        setZonaSeleccionada(match);
        setLocStatus('found');
      } else {
        setLocStatus('notfound');
      }
    } catch (err: any) {
      logger.warn('AUTH_REGISTER', 'No se pudo obtener la ubicaciÃ³n', err);
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
        logger.info('AUTH_LOGIN', `Iniciando sesiÃ³n para: ${cleanEmail}`);
        // 1. Iniciar sesiÃ³n directamente contra Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          logger.error('AUTH_LOGIN', `Error retornado por supabase.auth.signInWithPassword para ${cleanEmail}`, error);
          throw error;
        }

        if (!data.session || !data.user) {
          const sessionErr = new Error('No se pudo establecer la sesiÃ³n del usuario.');
          logger.error('AUTH_LOGIN', 'supabase.auth.signInWithPassword no devolviÃ³ sesiÃ³n vÃ¡lida', { data });
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

        // Guardar sesiÃ³n en el store
        setSession({
          token: data.session.access_token,
          userId: data.user.id,
          zoneId: effectiveZoneId,
          userFullName,
          userEmail: data.user.email,
        });

        logger.info('AUTH_LOGIN', `SesiÃ³n iniciada exitosamente para ${cleanEmail} en zona ${effectiveZoneId}`);
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

        // REQUISITO CRÃTICO: Si Supabase devuelve error, arrojarlo explÃ­citamente para detener el flujo
        if (error) {
          logger.error('AUTH_REGISTER', `Error devuelto por supabase.auth.signUp para ${cleanEmail}`, error);
          throw error;
        }

        // Caso borde de Supabase: Si el usuario ya existe en Supabase y confirmaciÃ³n estÃ¡ activa,
        // Supabase no devuelve error pero data.user?.identities estÃ¡ vacÃ­o []
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          const duplicateErr = new Error('Este correo ya estÃ¡ registrado en Barrio. Por favor ingresa a la pestaÃ±a "Iniciar sesiÃ³n".');
          logger.warn('AUTH_REGISTER', `Intento de registrar correo ya existente: ${cleanEmail}`);
          throw duplicateErr;
        }

        if (!data.user) {
          const noUserErr = new Error('No se pudo completar el registro de la cuenta.');
          logger.error('AUTH_REGISTER', 'supabase.auth.signUp retornÃ³ data sin usuario', { data });
          throw noUserErr;
        }

        logger.info('AUTH_REGISTER', `Usuario creado en auth.users con ID: ${data.user.id}`, {
          hasSession: Boolean(data.session),
        });

        // Si Supabase devuelve sesiÃ³n inmediata (auto-confirm activo)
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
            logger.warn('AUTH_REGISTER', 'Aviso al insertar en public.users (serÃ¡ manejado por el trigger SQL)', upsertErr);
          }

          setSession({
            token: data.session.access_token,
            userId: data.user.id,
            zoneId: zonaSeleccionada?.id ?? '',
            userFullName: nombre.trim(),
            userEmail: cleanEmail,
          });

          logger.info('AUTH_REGISTER', `Registro completado y sesiÃ³n establecida para ${cleanEmail}`);
          router.replace('/(tabs)/inicio');
        } else {
          // Si el proyecto requiere confirmar correo
          logger.info('AUTH_REGISTER', `Registro completado. Esperando confirmaciÃ³n de correo para ${cleanEmail}`);
          Alert.alert(
            'Â¡Cuenta creada!',
            'Revisa tu bandeja de entrada para verificar tu correo antes de ingresar.',
            [{ text: 'Entendido', onPress: () => setMode('login') }]
          );
        }
      }
    } catch (err: any) {
      const msg = err.message || 'OcurriÃ³ un error inesperado al autenticar.';
      logger.error('AUTH_ERROR', `Fallo capturado en autenticaciÃ³n (${mode}) para ${cleanEmail}`, {
        error: err,
        message: msg,
      });
      setErrorMsg(msg);
      Alert.alert('Error de AutenticaciÃ³n', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen scroll={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.titulo, { color: p.text }]}>
            {mode === 'login' ? 'Bienvenido a Barrio' : 'Ãšnete a tu Barrio'}
          </Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            {mode === 'login'
              ? 'Ingresa tus credenciales para conectar con tu comunidad.'
              : 'ConÃ©ctate con tus vecinos de forma cercana, transparente y segura.'}
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
              Iniciar sesiÃ³n
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
                placeholder="Ej. Alexander GarcÃ­a"
                placeholderTextColor={colors.gris}
                autoCapitalize="words"
                style={[
                  styles.input,
                  { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
                ]}
              />
            </>
          ) : null}

          <Text style={[styles.label, { color: p.text }]}>Correo electrÃ³nico</Text>
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

          <Text style={[styles.label, { color: p.text }]}>ContraseÃ±a</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="MÃ­nimo 6 caracteres"
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
                <>
                <Text style={[styles.privacyNote, { color: p.muted }]}>Sin permiso de ubicaciÃ³n. Elige tu zona abajo.</Text>
                <AppButton label="Abrir ajustes de ubicaciÃ³n" variant="link" onPress={openLocationSettings} />
              </>
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
              {zonesQuery.isLoading ? (
                <Text style={[styles.privacyNote, { color: p.muted }]}>Cargando zonas...</Text>
              ) : null}
              {zonesQuery.isError ? (
                <>
                  <Text style={[styles.privacyNote, { color: colors.rojo }]}>
                    No pudimos cargar las zonas. Revisa que el servidor estÃ© encendido.
                  </Text>
                  <AppButton label="Reintentar" variant="link" onPress={() => zonesQuery.refetch()} />
                </>
              ) : null}
            </>
          ) : null}
        </Animated.View>

        <View style={styles.footer}>
          <Text style={[styles.privacyNote, { color: p.muted }]}>
            Tus datos vecinales estÃ¡n protegidos mediante autenticaciÃ³n segura Supabase.
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
    fontSize: 14,
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
