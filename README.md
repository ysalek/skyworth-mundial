# Skyworth Promo Campaign - Documentación Técnica

Proyecto full-stack (React + Firebase) para gestión de campañas promocionales, validación de seriales y sorteo.

## 1. Instalación y Requisitos

### Prerrequisitos
- Node.js v18+
- Firebase CLI (`npm install -g firebase-tools`)
- Proyecto Firebase creado en consola (Plan Blaze requerido para Functions externas).

### Pasos Iniciales
1. **Clonar repositorio**:
   ```bash
   git clone <repo_url>
   cd skyworth-promo
   ```
2. **Instalar dependencias Frontend**:
   ```bash
   npm install
   ```
3. **Instalar dependencias Backend**:
   ```bash
   cd functions
   npm install
   cd ..
   ```

## 2. Configuración de Firebase

1. Copia tu configuración web en `firebase.ts`.
2. Login en CLI: `firebase login`.
3. Selecciona el proyecto: `firebase use <project-id>`.

## 3. Despliegue (Deploy)

Para desplegar todo (Frontend, Backend, Reglas):

```bash
# Construir frontend
npm run build

# Desplegar a Firebase
firebase deploy
```

Si solo actualizas frontend: `firebase deploy --only hosting`
Si solo actualizas backend: `firebase deploy --only functions`

## 4. Gestión de Administradores

El sistema usa **Custom Claims** para proteger el panel. Un usuario normal no puede acceder al Admin Panel aunque se registre.

### Crear un Admin
1. Registra un usuario en la pantalla de Login (`/` -> click en "Acceso Admin" -> Crear cuenta o usar existente en Auth console).
2. Descarga la **Service Account Key** desde *Project Settings > Service Accounts* en Firebase Console.
3. Guarda el archivo como `service-account-key.json` en la raíz (¡NO SUBIR A GIT!).
4. Ejecuta el script:
   ```bash
   node scripts/setAdmin.js tu.email@dominio.com
   ```
5. El usuario debe hacer Logout/Login para recibir el permiso.

## 5. Notas Operativas del Panel

### Carga de Códigos (CSV)
El archivo CSV debe tener **cabeceras** (la primera línea se ignora).
Columnas requeridas: `code, tvModel, inches, ticketMultiplier`
Ejemplo:
```csv
code,tvModel,inches,ticketMultiplier
SKY001,50SUE9350,50,1
SKY002,65SUE9500,65,2
```

### Notificaciones
- Configura las credenciales de **WhatsApp Cloud API** y **SendGrid** en la pestaña "Configuración".
- Los tokens se guardan en Firestore (`settings/`) y solo son legibles por el Admin SDK (Cloud Functions).
- Si un envío falla, aparecerá en rojo en la lista de Participantes. Usa el botón "Reintentar".

## 6. Seguridad
- **Firestore Rules**: Bloquean lectura pública de `participants` y `tv_codes`.
- **Storage Rules**: Permiten subida solo a `/uploads` (write-only).
- **Validación CI**: Se guarda un hash SHA256 para evitar registros dobles del mismo CI en la misma campaña, manteniendo privacidad parcial.

## 7. Estructura de Carpetas

```
/
├── public/             # Assets estáticos
├── src/
│   ├── components/     # Componentes React (Landing, Admin)
│   ├── firebase.ts     # Init de Firebase
│   ├── types.ts        # Interfaces TS compartidas
│   ├── App.tsx         # Routing principal
│   └── index.tsx       # Entry point
├── functions/          # Backend (Cloud Functions)
│   ├── src/index.ts    # Lógica de validación y triggers
│   └── package.json
├── scripts/            # Scripts de utilidad (Set Admin)
├── firestore.rules     # Reglas DB
├── storage.rules       # Reglas Archivos
└── firebase.json       # Config Hosting/Functions
```