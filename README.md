# ViveSong

ViveSong es una app web para músicos, cantantes, bandas e iglesias que necesitan gestionar canciones con acordes, preparar repertorios y tocar en directo con una vista limpia y legible.

## Stack

- React + TypeScript + Vite para una base frontend moderna, rápida y fácil de mantener.
- Vitest + Testing Library para lógica y componentes.
- Playwright para validar un flujo principal real en navegador.
- Persistencia local con `localStorage` para este primer MVP.

## Scripts

```bash
npm run dev
npm run build
npm run test
npm run test:e2e
npm run lint
```

## Backend Compartido Con Supabase

Para probar ViveSong con el grupo fuera de la red local:

1. Crea un proyecto en Supabase.
2. Copia `.env.example` como `.env.local`.
3. Rellena:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

4. En Supabase, abre `SQL Editor` y ejecuta [supabase/migrations/001_vivesong_core.sql](supabase/migrations/001_vivesong_core.sql).
5. Arranca `npm run dev`.
6. Crea una cuenta desde el panel lateral de ViveSong.
7. Comparte el codigo del grupo con los musicos para que puedan unirse.

La app usa Row Level Security: los miembros solo leen datos de su grupo, editores/admins modifican canciones y repertorios, y solo admins pueden borrar.

## Arquitectura Inicial

- `src/lib`: reglas de negocio puras, como parseo ChordPro, transposición, canciones, repertorios y storage.
- `src/components`: piezas visuales reutilizables.
- `src/data`: canciones y repertorios de ejemplo.
- `tests/e2e`: flujos de usuario con Playwright.

## Notas De Producto

La app está inspirada en la necesidad general de organizar música en vivo, pero usa marca, interfaz, textos e iconografía propios. La persistencia local es suficiente para una primera versión; para colaboración entre equipos, el siguiente paso natural es añadir backend, cuentas y sincronización.
