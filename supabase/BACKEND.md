# Tile Tales — Backend (Supabase)

Decisión 2026-06-07: Supabase entra para que el usuario no pierda sus tiles al reinstalar o cambiar de dispositivo.

**Actualización 2026-07-05:** v1 se publicó **local-only** (sin cuenta). El backup por cuenta se retoma en **v1.1** sobre esta misma base, con dos cambios de rumbo:
- **Auth pasa a Sign in with Apple** (proveedor único), jubilando el email+password.
- El schema añade `is_public` (migración `0002_social_seam.sql`) como **costura** para el mapa comunal futuro — sin activar nada social ahora.
- ⚠️ El proyecto Supabase anterior fue **borrado** (el host ni resuelve por DNS). Hay que **recrearlo** desde estas migraciones.

## Alcance v1.1 (backup/sync personal)

- **Auth: Sign in with Apple** (proveedor único, decidido 2026-07-05). Un toque, sin contraseñas ni emails de verificación: el identity token de Apple se canjea por sesión Supabase vía `signInWithIdToken` (nonce raw + su SHA256 a Apple). Al ser proveedor único no arrastra el requisito de la guideline 4.8. El nombre de Apple (solo llega en el **primer** login) se guarda en user metadata (`full_name`) para el display name público futuro.
- **Sync personal**: tiles + albums + imágenes capturadas. El mapa comunitario / social queda fuera (v2).
- **Wallpapers NO se sincronizan** — son regenerables, se quedan en local.
- **Borrado de cuenta in-app** — obligatorio por App Store guideline 5.1.1(v). Edge Function `functions/delete-account` (borra imágenes de storage → `auth.users on delete cascade` limpia las tablas).

## Modelo

Espejo del store local, con claves compuestas `(user_id, id)` porque los sample tiles (`t1..t14`) comparten id entre usuarios.

- `tiles` — `image_ref` distingue bundled (`/tiles/x.webp`) de captura (`storage:<user_id>/<tile_id>.webp`). Columna `is_public` (0002) por defecto `false`.
- `albums` + `album_tiles` (membership)
- Bucket privado `tiles`, path `<user_id>/<tile_id>.webp`, acceso solo del dueño

## Estrategia de sync (local-first)

1. La app funciona igual sin cuenta (local). Login es opcional.
2. Al hacer login por primera vez: **upload de todo lo local** (tiles, albums, imágenes → storage).
3. Después: last-write-wins por `updated_at`. Soft deletes (`deleted_at`) propagan borrados entre dispositivos.
4. Pull al arrancar + push tras cada mutación (debounced 2s). Sin realtime en v1.1.

## Migraciones

- `migrations/0001_initial_schema.sql` — tablas + triggers updated_at + RLS (own-rows) + bucket y policies de storage.
- `migrations/0002_social_seam.sql` — `is_public` en `tiles` (default false). Documenta (comentada) la policy de lectura pública que abre el camino social sin reescritura.

Se aplican vía MCP de Supabase o SQL editor del dashboard. Este directorio es la fuente de verdad del schema.

## Pendiente al crear el proyecto (v1.1)

- [ ] Crear proyecto Supabase (región eu-west, free tier). ⚠️ Los proyectos free se pausan tras ~1 semana sin actividad — no dejarlo muerto.
- [ ] Ejecutar `0001_initial_schema.sql` y luego `0002_social_seam.sql`.
- [ ] **Auth → habilitar el provider Apple**: en el Apple Developer portal crear un **Services ID** + **Sign in with Apple key** y pegarlos en Supabase (Auth → Providers → Apple). El bundle `com.tiletales.app` como client id nativo.
- [ ] **Desplegar la Edge Function** `delete-account` (`supabase functions deploy delete-account`); necesita `SUPABASE_SERVICE_ROLE_KEY` en secrets.
- [ ] Copiar `SUPABASE_URL` + anon (publishable) key a **`app/.env.local`** (web) y a **`SupabaseConfig`** en `ios/.../Services/SupabaseService.swift` (ahora placeholders `YOUR_PROJECT` / `YOUR_ANON_PUBLISHABLE_KEY`).

## Pendiente ANTES de publicar el build con backup (App Store)

- [ ] **Xcode**: la capability Sign in with Apple ya está en `TileTales.entitlements` + `CODE_SIGN_ENTITLEMENTS`. Con firma automática, Xcode registra la capability en el App ID al compilar (Kike logado). Verificar que el provisioning la incluye.
- [ ] **Actualizar privacy**: al salir el backup, los datos (fotos + ubicación + email/Apple ID) **dejan el dispositivo** ligados a una cuenta. Actualizar la **privacy policy** (gist) + el **cuestionario App Privacy** en App Store Connect (Data linked to you: user content, coarse location, email; uso = app functionality). El borrado de cuenta ya está cubierto.
- [ ] **Redirect URLs** (solo web): añadir la URL de prod de Vercel a Auth → URL Configuration si se reactiva el login web.
- [ ] SMTP propio (Resend): **ya no aplica** — con Sign in with Apple no se envían emails.
