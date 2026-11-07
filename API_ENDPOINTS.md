# Guía de Endpoints de la API Barrio 🏘️

Esta guía detalla de forma clara y amigable todos los endpoints disponibles en el Backend de **Barrio**, los payloads requeridos y los formatos de respuesta estándar (éxito y error), diseñada para que el equipo de Frontend pueda consumirlos sin fricción.

---

## 🌐 Información General y Convenciones

* **Base URL de Desarrollo (Emulador / Local):** `http://localhost:3000/api` (o `http://localhost:3000/api/v1`)
* **Base URL para Dispositivos Físicos (LAN):** `http://<IP_DE_TU_PC>:3000/api/v1` *(Ejemplo: `http://192.168.101.12:3000/api/v1`)*
* **Documentación Interactiva (Swagger UI):** `http://localhost:3000/api/docs`
* **Autenticación:** En endpoints protegidos, enviar la cabecera HTTP:
  ```http
  Authorization: Bearer <access_token_de_supabase>
  ```

### Estructura Estándar de Respuesta

#### Respuesta Exitosa (200 / 201)
```json
{
  "success": true,
  "message": "Mensaje descriptivo opcional",
  "data": { ... },
  "code": 200
}
```

#### Respuesta de Error (400 / 401 / 403 / 404 / 500)
```json
{
  "success": false,
  "error": "Explicación legible del motivo del error",
  "code": 403
}
```

---

## 🛠️ 1. Módulo "Día a Día": Oficios y Perfiles Profesionales

### 1.1 Catálogo de Oficios
* **Ruta:** `GET /profiles/oficios`
* **Autenticación:** Pública (No obligatoria).
* **Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "7fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Gasfitería",
      "category": "gasfiteria",
      "icon": "wrench",
      "description": "Reparaciones de tuberías, grifos y sanitarios"
    }
  ],
  "code": 200
}
```

### 1.2 Listar Perfiles Profesionales por Zona
* **Ruta:** `GET /profiles`
* **Parámetros Query:**
  * `zone_id` *(requerido, UUID)*: Identificador de la zona vecinal.
  * `category` *(opcional, string)*: Filtrar por categoría (`gasfiteria`, `electricidad`, `carpinteria`, etc.).
* **Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      "user_id": "f3c02c4d-f351-4779-a12d-6cce45231664",
      "oficio_id": "7fa85f64-5717-4562-b3fc-2c963f66afa6",
      "description": "Maestro gasfitero con 10 años en el barrio",
      "years_experience": 10,
      "vouches_count": 5,
      "user": {
        "full_name": "Wilmer Samir Loro Amaya",
        "avatar_url": null
      },
      "oficio": {
        "name": "Gasfitería",
        "category": "gasfiteria"
      }
    }
  ],
  "code": 200
}
```

### 1.3 Crear o Editar Perfil Profesional
* **Ruta:** `POST /profiles`
* **Autenticación:** Requerida (`Bearer <token>`).
* **Body:**
```json
{
  "oficio_id": "7fa85f64-5717-4562-b3fc-2c963f66afa6",
  "zone_id": "a23c2ac0-4434-48bb-a091-89fbedf46dc6",
  "description": "Especialista en instalaciones sanitarias y fugas de agua",
  "years_experience": 8,
  "location_lat": -12.0463,
  "location_lng": -77.0428
}
```

### 1.4 Vistos Buenos Vecinales (Vouches)
* **Dar Visto Bueno:** `POST /profiles/:id/vouch` (Bearer Token requerido)
* **Retirar Visto Bueno:** `DELETE /profiles/:id/vouch` (Bearer Token requerido)
* **Consultar si ya di Visto Bueno:** `GET /profiles/:id/vouch/status` (Bearer Token requerido)
  * Respuesta: `{ "success": true, "data": { "hasVouched": true }, "code": 200 }`

---

## 🤝 2. Módulo "Día a Día": Favores Vecinales

### 2.1 Listar Favores Activos
* **Ruta:** `GET /favors`
* **Parámetros Query:**
  * `zone_id` *(requerido, UUID)*.
  * `type` *(opcional)*: `herramienta`, `ayuda_temporal`, `donacion_materiales`, `intercambio_habilidades`, `movilidad_solidaria`.
* **Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "e45a2b10-1111-2222-3333-444455556666",
      "client_id": "c0a80101-1234-4567-89ab-01a1b442bf73",
      "author_id": "f3c02c4d-f351-4779-a12d-6cce45231664",
      "type": "herramienta",
      "title": "Prestamo de taladro percutor",
      "description": "Necesito colgar un estante hoy por la tarde, 1 hora max",
      "status": "abierta",
      "author": {
        "full_name": "Wilmer Samir Loro Amaya",
        "avatar_url": null
      }
    }
  ],
  "code": 200
}
```

### 2.2 Crear Favor Comunitario
* **Ruta:** `POST /favors`
* **Autenticación:** Requerida (`Bearer <token>`).
* **Body:**
```json
{
  "client_id": "c0a80101-1234-4567-89ab-01a1b442bf73",
  "zone_id": "a23c2ac0-4434-48bb-a091-89fbedf46dc6",
  "type": "ayuda_temporal",
  "title": "Ayuda para cargar mueble pesado",
  "description": "Vecinos, requiero una mano para subir un ropero al 2do piso",
  "location_lat": -12.046,
  "location_lng": -77.042
}
```
> **Nota de Idempotencia:** El `client_id` debe ser un UUID generado en el móvil (`Crypto.randomUUID()`) para evitar duplicados si la red se interrumpe.

### 2.3 Postularse o Mostrar Interés en un Favor
* **Ruta:** `POST /favors/:id/interest`
* **Autenticación:** Requerida (`Bearer <token>`).
* **Body:**
```json
{
  "message": "Hola vecino, tengo taladro y puedo prestártelo hoy a las 5pm"
}
```

---

## 🚨 3. Módulo de Emergencias

### 3.1 Consultar Estado de la Emergencia
* **Ruta:** `GET /emergency?zone_id=<UUID>`
* **Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "status": "activa",
    "reason": "Alerta por lluvias intensas e inundación",
    "activated_at": "2026-11-07T04:20:00.000Z"
  },
  "code": 200
}
```

### 3.2 Directorio de Apoyo y Servicios de Emergencia
* **Ruta:** `GET /emergency/services?zone_id=<UUID>`
* **Respuesta Exitosa (200):** Retorna lista de centros médicos, bomberos, comisarías y brigadas barriales con sus números de contacto.

### 3.3 Activar Estado de Emergencia
* **Ruta:** `POST /emergency/activate`
* **Autenticación:** Requerida (`Bearer <token>`).
* **Regla de Seguridad:** El usuario debe tener `emergency_role = true`. De lo contrario, devuelve `HTTP 403 Forbidden`.
* **Body:**
```json
{
  "zone_id": "a23c2ac0-4434-48bb-a091-89fbedf46dc6",
  "reason": "Corte masivo de agua y afectación de viviendas en el sector"
}
```

### 3.4 Desactivar Estado de Emergencia
* **Ruta:** `POST /emergency/deactivate`
* **Autenticación:** Requerida (`Bearer <token>`).
* **Regla de Seguridad:** Requiere `emergency_role = true`.
* **Body:**
```json
{
  "zone_id": "a23c2ac0-4434-48bb-a091-89fbedf46dc6",
  "reason": "Situación controlada por las brigadas"
}
```

### 3.5 Reportar Vulnerabilidad Comunitaria
* **Ruta:** `POST /emergency/reports`
* **Autenticación:** Requerida (`Bearer <token>`).
* **Regla de Privacidad (Matemática):** La API redondea automáticamente `lat` y `lng` a 3 decimales (~111 metros de precisión) para proteger la ubicación exacta del domicilio.
* **Body:**
```json
{
  "zone_id": "a23c2ac0-4434-48bb-a091-89fbedf46dc6",
  "lat": -12.0463748,
  "lng": -77.0427891,
  "description": "Adultos mayores sin suministro de medicamentos ni agua",
  "needs": ["agua", "medicinas"],
  "is_anonymous": true
}
```

### 3.6 Listar Reportes de Vulnerabilidad
* **Ruta:** `GET /emergency/reports?zone_id=<UUID>`
* **Regla de Privacidad (Anonimización):** Si `is_anonymous = true`, la respuesta NO incluye `reporter_user_id` ni datos de perfil del usuario que emitió la alerta.

---

## ⚡ 4. Motor de Sincronización Offline (`/api/sync`)

Diseñado para procesar operaciones almacenadas en SQLite/WatermelonDB/AsyncStorage cuando el dispositivo recupera la conexión a internet.

* **Ruta:** `POST /sync`
* **Autenticación:** Requerida (`Bearer <token>`).
* **Regla de Idempotencia:** Si un `client_id` ya fue procesado con éxito anteriormente, el backend no duplica la acción en la base de datos y retorna el estado de la operación con `ignored: true` y HTTP 200.
* **Body:**
```json
[
  {
    "client_id": "c0a80101-1234-4567-89ab-01a1b442bf73",
    "operation": "create_favor",
    "payload": {
      "type": "ayuda_temporal",
      "title": "Favor creado offline en la calle",
      "description": "Sin datos móviles al momento de publicar",
      "zone_id": "a23c2ac0-4434-48bb-a091-89fbedf46dc6"
    }
  },
  {
    "client_id": "f5b90202-5678-4321-ba98-02b2c553cf84",
    "operation": "create_vulnerability_report",
    "payload": {
      "lat": -12.04638,
      "lng": -77.04289,
      "description": "Persona atrapada por inundación",
      "needs": ["rescate", "frazadas"],
      "is_anonymous": false,
      "zone_id": "a23c2ac0-4434-48bb-a091-89fbedf46dc6"
    }
  }
]
```
* **Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Lote de sincronización offline procesado exitosamente",
  "data": {
    "total": 2,
    "processed": 2,
    "results": [
      {
        "client_id": "c0a80101-1234-4567-89ab-01a1b442bf73",
        "operation": "create_favor",
        "status": "enviado",
        "data": { "id": "ed630eac-cb8a-40ac-ac6a-52ddac663c42", "status": "abierta" }
      },
      {
        "client_id": "f5b90202-5678-4321-ba98-02b2c553cf84",
        "operation": "create_vulnerability_report",
        "status": "enviado",
        "data": { "id": "76110a3c-1111-2222-3333-890abcdef123" }
      }
    ]
  },
  "code": 200
}
```

---

## 💡 Recomendaciones para el Cliente Móvil (Frontend)

1. **Tokens de Autorización:** Guarda el `access_token` en `expo-secure-store`. Pásalo en cada llamada como `Authorization: Bearer <token>`.
2. **Generación de IDs Offline:** Para favores o reportes creados sin conexión, genera siempre un UUID v4 en el cliente (`Crypto.randomUUID()`) y envíalo en el campo `client_id`.
3. **Manejo de Errores HTTP:**
   * `401 Unauthorized`: Redirigir al usuario al login para refrescar sesión.
   * `403 Forbidden`: Indicar visualmente que la acción requiere permisos especiales (ej: rol de emergencia).
   * `400 Bad Request`: Mostrar al usuario los detalles de validación contenidos en el campo `"error"`.
