# Tile Tales — Backend (Supabase)

Decisión 2026-06-07: Supabase entra en v1 (antes estaba diferido a v1.1). Objetivo: que el usuario no pierda sus tiles al reinstalar o cambiar de dispositivo.

## Alcance v1

- **Auth: email + password** (cambiado 2026-06-07, antes magic link). Motivo: el magic link se abre en Safari fuera de la PWA/app nativa (sesión en el contexto equivocado) y exigía universal links en iOS. Sin login social → no obliga a Sign in with Apple (guideline 4.8). **Autoconfirm activado** (sin email de verificación, `password_min_length: 8`) → el flujo feliz no depende del SMTP; el único email es el reset de contraseña (raro, plantilla por defecto tolerable hasta tener SMTP propio).
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

- [ ] **SMTP propio (Resend)** — YA NO BLOQUEA v1 (con password + autoconfirm el único email es el reset). Nice-to-have: brandear el email de reset con `templates/sign-in-email.html` (adaptar copy). Pasos: cuenta Resend (free 3k/mes) → verificar kikelopez.es (3 registros DNS) → SMTP en Supabase Auth → plantilla vía `PATCH /v1/projects/{ref}/config/auth` (con SMTP por defecto devuelve 400).
- [ ] **Redirect URLs**: añadir la URL de prod de Vercel (y el scheme de la app iOS) a Auth → URL Configuration. Ahora solo funciona localhost.
- [ ] Config de iOS: URL + anon key en el proyecto Xcode (port supabase-swift)
