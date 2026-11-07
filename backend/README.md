# Barrio Backend API 🏘️

API RESTful modular basada en **Clean Architecture** para la plataforma vecinal y comunitaria **Barrio**. Construida con Node.js, Express, TypeScript estricto y Supabase (PostgreSQL con Row Level Security).

---

## 🛠️ Stack Tecnológico

- **Runtime**: Node.js v20+ / v24+
- **Framework Web**: Express.js 4.x
- **Lenguaje**: TypeScript 5.x (Strict mode sin `any`)
- **Base de Datos**: PostgreSQL 15+ en Supabase
- **Autenticación**: Supabase Auth (Bearer JWT Tokens)
- **Validación de Datos**: Zod
- **Seguridad**: Helmet, CORS, Row Level Security (RLS)
- **Monitoreo & Logs**: Morgan

---

## 📁 Estructura del Proyecto

```
backend/
├── .env.example               # Plantilla de variables de entorno
├── tsconfig.json              # Configuración TypeScript estricta
├── package.json               # Dependencias del proyecto
├── scripts/seed-auth.ts       # Crea las cuentas de demo (npm run seed)
└── src/
    ├── app.ts                 # Configuración de Express, CORS y middlewares
    ├── server.ts              # Entry point con Graceful Shutdown
    ├── config/                # Variables de entorno y clientes Supabase
    ├── controllers/           # Controladores de la API
    ├── middlewares/           # Autenticación JWT y Manejador Global de Errores
    ├── routes/                # Enrutamiento modular agrupado bajo /api/v1
    ├── services/              # Lógica de negocio e interacción con Supabase
    ├── types/                 # Tipos de base de datos generados y extensiones
    └── utils/                 # Validadores y DTOs con Zod
```

---

## 🚀 Instalación y Puesta en Marcha

### 1. Requisitos Previos

- Node.js instalado (v18 o superior)
- Instancia o proyecto activo en Supabase

### 2. Configurar Variables de Entorno

Copia el archivo de ejemplo y completa tus credenciales de Supabase:

```bash
cp .env.example .env
```

Variables requeridas en `.env`:
```ini
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_clave_anonima
SUPABASE_SERVICE_ROLE_KEY=tu_clave_service_role
CORS_ORIGIN=*
SEED_PASSWORD_WILMER=elige_una_clave
SEED_PASSWORD_EDSON=elige_una_clave
SEED_PASSWORD_ADMIN=elige_una_clave
```

Las variables `SEED_PASSWORD_*` solo las usa `npm run seed`. Supabase exige por defecto un mínimo de 6 caracteres.

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Preparar la Base de Datos (Seed)

Requiere la [CLI de Supabase](https://supabase.com/docs/guides/cli). Ejecuta los pasos en este orden, desde la raíz del repositorio y sobre un proyecto vacío:

```bash
# 1. Aplicar las migraciones de supabase/migrations
supabase login
supabase link --project-ref <ref-de-tu-proyecto>
supabase db push

# 2. Crear las cuentas de demo y sus perfiles
cd backend
npm run seed
```

Las cuentas deben crearse después de las migraciones: el seed necesita las tablas y la zona Castilla. La migración `0010` no crea cuentas porque `public.users` depende de `auth.users`, así que en una base limpia no inserta filas.

Cuentas creadas, todas confirmadas y en la zona Castilla:

| Correo | Nombre | Rol | Contraseña |
| --- | --- | --- | --- |
| `samirloroamaya24@gmail.com` | Wilmer | Vecino | `SEED_PASSWORD_WILMER` |
| `edson@gmail.com` | Edson | Vecino | `SEED_PASSWORD_EDSON` |
| `admin@gmail.com` | Admin | Administrador | `SEED_PASSWORD_ADMIN` |

- Puedes repetir `npm run seed`. Una cuenta que ya existe conserva su contraseña y su ID.
- Un administrador no puede moderar sus propios favores. Para probar el flujo, publica con Wilmer o Edson y aprueba con Admin.
- En la app, configura `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` en el `.env` de la raíz. Si faltan, la app usa el proyecto Supabase por defecto de `src/lib/supabase.ts`.

### 5. Ejecutar en Modo Desarrollo

```bash
npm run dev
```

El servidor estará escuchando en `http://localhost:3000/api/v1`.

### 6. Compilar y Ejecutar en Producción

```bash
npm run build
npm start
```

---

## 📡 Endpoints de la API (`/api/v1`)

### Salud del Sistema
- `GET /health`: Estado del servicio y verificación de conectividad con Supabase.

### Perfiles Profesionales y Oficios
- `GET /profiles?zoneId=<uuid>&category=<categoria>`: Listar perfiles en una zona.
- `GET /profiles/oficios`: Catálogo de oficios comunitarios disponibles.
- `GET /profiles/:id`: Detalle de un perfil profesional.
- `POST /profiles`: Registrar perfil profesional (Requiere autenticación).
- `PATCH /profiles/:id`: Actualizar perfil profesional del usuario autenticado.

### Vistos Buenos (Vouches)
- `POST /profiles/:id/vouch`: Otorgar visto bueno a un perfil (Recalcula validación automáticamente).
- `DELETE /profiles/:id/vouch`: Retirar visto bueno otorgado.
- `GET /profiles/:id/vouch/status`: Consultar si el usuario autenticado ya dio visto bueno.

### Favores Vecinales
- `GET /favors?zoneId=<uuid>&type=<tipo>&status=<estado>`: Listar favores activos.
- `GET /favors/:id`: Detalle de un favor e interesados.
- `POST /favors`: Publicar solicitud u oferta de favor (Soporta `client_id` para idempotencia offline).
- `PATCH /favors/:id`: Actualizar estado o asignar favor.
- `POST /favors/:id/interest`: Manifestar interés en ayudar en un favor.

### Estado de Emergencia y Soporte
- `GET /emergency?zoneId=<uuid>`: Estado de alerta o contingencia de la zona.
- `POST /emergency`: Declarar o levantar estado de emergencia (Requiere rol autorizado).
- `GET /emergency/services?zoneId=<uuid>`: Directorio de entidades de auxilio.

### Reportes de Vulnerabilidad
- `GET /reports?zoneId=<uuid>`: Listar alertas vecinales activas.
- `POST /reports`: Registrar reporte (Soporta reportes anónimos).

### Recursos Críticos
- `GET /resources?zoneId=<uuid>&kind=pedido|oferta`: Listar inventario solidario en emergencia.
- `POST /resources`: Registrar pedido u oferta de insumo crítico.

---

## 🔒 Seguridad y Manejo de Errores

1. **Row Level Security (RLS)**: Las operaciones de usuarios autenticados usan `createSupabaseClient(token)` garantizando que solo accedan o modifiquen lo que sus políticas permitan.
2. **Formato Estándar de Errores**:
```json
{
  "success": false,
  "error": "Descripción detallada del error",
  "code": 400
}
```
