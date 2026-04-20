# Despliegue de Tuning HUB

## Opcion recomendada

- Frontend en `Firebase Hosting`
- Backend en `Render`

Es la combinacion mas simple para este proyecto.

## 1. Subir el backend a Render

Render debe apuntar a este proyecto con:

- Build command: `npm install`
- Start command: `npm run server`

Variables de entorno del backend en Render:

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-4o-mini`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

No hace falta definir `PORT`; Render lo inyecta automaticamente.

### FIREBASE_SERVICE_ACCOUNT_JSON

En Firebase Console:

1. Entra en `Configuracion del proyecto`
2. `Cuentas de servicio`
3. `Generar nueva clave privada`
4. Abre el JSON descargado
5. Copia todo el contenido en una sola variable de entorno llamada `FIREBASE_SERVICE_ACCOUNT_JSON`

Cuando el backend este publicado, prueba:

- `https://tu-backend.onrender.com/api/health`

Debe responder:

```json
{"ok":true}
```

## 2. Publicar el frontend

Antes de compilar el frontend, crea un `.env.production` con:

```bash
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-project-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_API_BASE_URL=https://tu-backend.onrender.com
```

Compila:

```bash
npm run build
```

## 3. Subir el frontend a Firebase Hosting

Instala la CLI si no la tienes:

```bash
npm install -g firebase-tools
```

Inicia sesion:

```bash
firebase login
```

Inicializa hosting dentro del proyecto:

```bash
firebase init hosting
```

Cuando pregunte:

- public directory: `dist`
- single-page app: `yes`
- sobrescribir `index.html`: `no`

Despliega:

```bash
firebase deploy
```

## 4. Comprobacion final

Pruebas minimas despues de publicar:

1. Abre la web publica.
2. Selecciona una marca, modelo, generacion y motor.
3. Pulsa el boton para buscar la build.
4. Comprueba que aparece la pantalla de carga.
5. Verifica que sale una build real o generada.

## 5. Recomendacion importante

La clave de OpenAI que compartiste en el chat deberias rotarla.

Haz esto en OpenAI:

1. Borra la clave anterior.
2. Crea una nueva.
3. Sustituyela en Render.

## 6. Alternativa rapida

Si no quieres usar Firebase Hosting, tambien puedes subir el frontend a `Vercel`. En ese caso solo cambia:

- `VITE_API_BASE_URL=https://tu-backend.onrender.com`

Y dejas el backend igual en Render.
