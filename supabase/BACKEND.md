# Tile Tales — Backend (Supabase)

Decisión 2026-06-07: Supabase entra en v1 (antes estaba diferido a v1.1). Objetivo: que el usuario no pierda sus tiles al reinstalar o cambiar de dispositivo.

## Alcance v1

- **Auth: email magic link / OTP únicamente.** Sin login social → no obliga a Sign in with Apple (guideline 4.8). SIWA puede añadirse después como conveniencia.
- **Sync personal**: tiles + albums + imágenes capturadas. El mapa comunitario / social queda fuera (v1.1+).
- **Wallpapers NO se sincronizan** — son regenerables, se quedan en local.
- **Borrado de cuenta in-app** — obligatorio por App Store guideline 5.1.1(v). `auth.users on delete cascade` limpia las tablas; las imágenes de storage se borran desde el cliente antes de llamar al delete.

## Modelo

Espejo del store local (`app/src/lib/store.ts`), con claves compuestas `(user_id, id)` porque los sample tiles (`t1..t14`) comparten id entre usuarios.

- `tiles` — `image_ref` distingue bundled (`/tiles/x.webp`) de captura (`storage:<user_id>/<tile_id>.webp`)
- `albums` + `album_tiles` (membership)
- Bucket privado `tiles`, path `<user_id>/<tile_id>.webp`, acceso solo del dueño (signed URLs en cliente)

## Estrategia de sync (local-first)

1. La app funciona igual que ahora sin cuenta (localStorage + IndexedDB). Login es opcional.
2. Al hacer login por primera vez: **upload de todo lo local** (tiles, albums, blobs de IDB → storage).
3. Después: last-write-wins por `updated_at`. Soft deletes (`deleted_at`) para que los borrados se propaguen entre dispositivos.
4. Pull al arrancar + push tras cada mutación (debounced). Sin realtime en v1 — no hay colaboración.

## Migraciones

`migrations/0001_initial_schema.sql` — tablas + triggers updated_at + RLS + bucket y policies de storage.

Se aplican vía MCP de Supabase (o SQL editor del dashboard). Mantener este directorio como fuente de verdad de los cambios de schema.

## Pendiente al crear el proyecto

- [ ] Crear proyecto Supabase (región eu-west, free tier)
- [ ] Ejecutar `0001_initial_schema.sql`
- [ ] Configurar Auth: habilitar email OTP, desactivar signups con password si no se usan
- [x] ~~Copiar `SUPABASE_URL` + `SUPABASE_ANON_KEY` a `app/.env.local`~~ (hecho 2026-06-07)

## Pendiente ANTES de producción / App Store

- [ ] **SMTP propio (Resend)** — bloquea dos cosas: el rate limit del free tier (3-4 emails/h) y la personalización de plantillas (el Management API devuelve 400 con el SMTP por defecto). Pasos: cuenta en Resend (free 3k/mes) → verificar dominio de Kike (kikelopez.es, 3 registros DNS) → configurar SMTP en Supabase Auth settings → aplicar `templates/sign-in-email.html` como plantilla de Confirm signup Y Magic Link (vía dashboard o `PATCH /v1/projects/{ref}/config/auth`). El email actual sale como "Supabase Auth <noreply@mail.app.supabase.io>" con copy genérico de signup — confuso y con pinta de spam.
- [ ] **Redirect URLs**: añadir la URL de prod de Vercel (y el scheme de la app iOS) a Auth → URL Configuration. Ahora solo funciona localhost.
- [ ] Config de iOS: URL + anon key en el proyecto Xcode (port supabase-swift)
