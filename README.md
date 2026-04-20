# Tuning HUB

App web mobile-first para que el usuario seleccione su coche y reciba una build recomendada en 3 stages. La app combina:

- catalogo de vehiculos en Firebase / Firestore
- builds guardadas en base de datos
- generacion con OpenAI cuando no existe una build previa
- interfaz pensada para trafico movil

## Stack

- `Vite + React`
- `Firebase Web SDK`
- `Firestore`
- `Node.js` para el backend
- `OpenAI Responses API`

## Arranque local

1. Instala dependencias:

```bash
npm install
```

2. Crea `.env` a partir de `.env.example`

3. Arranca frontend y backend en dos terminales:

```bash
npm run dev
```

```bash
npm run server
```

Frontend local:

- `http://localhost:5173`

Backend local:

- `http://localhost:8787`
- salud: `http://localhost:8787/api/health`

## Variables de entorno

Frontend:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_API_BASE_URL`

Backend:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `PORT` o `BACKEND_PORT`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

En local tambien puedes usar:

- `FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json`

## Flujo de la app

1. El usuario rellena el formulario del vehiculo.
2. La app busca una build existente en Firestore.
3. Si no encuentra una build valida, llama al backend.
4. El backend consulta OpenAI y genera una recomendacion en `STAGE 1`, `STAGE 2` y `STAGE 3`.
5. La build generada se guarda en Firestore para reutilizarla despues.

## Scripts utiles

```bash
npm run dev
npm run server
npm run build
npm run preview
npm run seed:firestore -- firebase/recomendaciones-v5-seed.json --reset
```

## Publicacion recomendada

Frontend:

- `Firebase Hosting`

Backend:

- `Render`

Guia completa:

- [DEPLOY.md](C:/Users/rober/OneDrive/Escritorio/Tuning HUB/DEPLOY.md)
