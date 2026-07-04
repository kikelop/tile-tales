# Tile Tales — Plan hacia la App Store (v1)

_Última actualización: 2026-07-03. Estado de arranque de futuras sesiones — leer esto primero._

## Dónde estamos (hito clave)
- ✅ **Apple Developer Program Individual PAGADO y ACTIVADO** (2026-07-02, pedido `W1587743365`). Ya hay acceso a **App Store Connect**. El blocker de los 99€ está cerrado.
- ✅ **La app nativa compila y corre en el iPhone de Kike** (iOS 26.5, UDID `00008101-001D4C581AE0001E`). No es maqueta: es la app real.
- ✅ Firma: el **equipo personal `4V43H3637W`** (el que ya usaba para device) es ahora de **pago** con el mismo Team ID → en Xcode **NO hay que cambiar equipo**, ya puede archivar y distribuir. **Nada de la org SOCIEDAD ESPAÑOLA DE ORNITOLOGIA** (esa membresía heredada no se usa ni bloquea).
- ✅ UX + branding de la app al día (acento azul `#3586F2` tokenizado en `enum Brand`, fondos `#FAF9F6`, splash imagen única, editor de foto y cámara arreglados, iconos rellenos, Compose pulido).

Comandos de build/instalación en device (referencia):
```
xcodebuild -scheme TileTales -destination 'id=00008101-001D4C581AE0001E' -configuration Debug -allowProvisioningUpdates build
xcrun devicectl device install app --device 00008101-001D4C581AE0001E <ruta .app>
```
Simulador de trabajo: iPhone 17 `FAD576B2-CC3E-4521-AD2B-01C2A9561933`.

---

## Decisiones pendientes de Kike (bloquean submission)
1. **Sign-in en v1.** Supabase está muerto (`vjwibllynlxxwkspbnav.supabase.co` = NXDOMAIN, proyecto pausado/borrado) → el botón de Sign in da error. Un botón roto es riesgo de **rechazo en review**. Elegir:
   - **(A) Recrear Supabase** → Kike crea proyecto nuevo y pasa **URL + anon key** → Claude las mete en `Services/SupabaseService.swift` (l.9-10). Login/sync vuelve.
   - **(B) Ocultar/deshabilitar Sign in para v1** (login/sync estaba fuera de v1 igual) → Claude oculta la entrada. Más rápido para publicar.
2. **Solapes del tour de X** (mismo tema, ángulo distinto): tour `3d viewer` ↔ decisión `scenekit viewer`; tour `add tile` ↔ `edit photo later`; tour `compose` ↔ `compose rename`. Decidir si conviven o se quita uno.

---

## Tareas de Kike (manuales, su máquina/cuentas)
- 🎥 **Grabar los vídeos** de las features para los posts del tour de X (7) y donde aplique. En cuanto tenga material → avisar a Claude para programar.
- 🔁 **Recrear Supabase** (si elige opción A) → pasar URL + anon key.
- 🧰 **Xcode: Product → Archive → Distribute App → App Store Connect (Upload)** — el primer build de verdad a la nube (GUI, Claude no puede).
- 🌐 **App Store Connect (web):**
  - Crear la ficha de la app (bundle `com.tiletales.app`, nombre "Tile Tales").
  - Pegar metadata (ya redactada en `ios/STORE_METADATA.md`).
  - Subir screenshots (specs en `ios/SCREENSHOT_SPECS.md`).
  - **Hospedar la privacy policy** (`ios/PRIVACY_POLICY.md`) en una URL pública y pegarla.
- 📱 **Prueba final en device** vía TestFlight (por aire, sin cable, sin caducar a 7 días).

## Tareas de Claude (próximas sesiones)
- 🧹 **Limpieza de release (JUSTO antes del build de archive, no antes):**
  - Quitar los hooks debug de `ContentView.swift`: método `applyUITestArgs` + `showDebugEditor` + los args `-uiSkipIntro` / `-uiTab` / `-uiViewer` / `-uiPhotoEdit` + su `.fullScreenCover`.
  - `alwaysShowIntro = true` → **false** (o restaurar el check `!onboardingSeen`).
- 🔌 **Supabase:** meter URL+key nuevas (opción A) **o** ocultar Sign in (opción B), según decida Kike.
- 📅 **Programar el tour de X** cuando Kike tenga vídeos: meter los 7 posts `TT · tour · 1-7` al **frente del carril Tile Tales**, empujando los beats de decisión hacia atrás. **Los Playground se quedan fijos** en sus días. Estructura semanal **3 TT + 2 PG**. Orden objetivo del carril TT: `tour 1-7 → paid the 99 → ornitología → swipe → dark mode → rebrand → scenekit → edit photo → splash → compose`.
- ✍️ **Reescribir el set FIRE-WHEN-REAL** (sigue en voz vieja todo-minúscula) a la voz nueva, cada uno cuando vaya a dispararse: first build, camera wall, testflight first tester, icon+screenshots, submitted to review, rejected, it's live. Voz nueva = ver memoria `feedback_x_writing_style` (capitalización natural, "I" y nombres propios, frases que fluyen, sin moraleja fabricada, casual).

---

## Secuencia de hitos (orden real hasta publicar)
1. **Decidir sign-in** (A recrear / B ocultar) + Claude lo aplica.
2. **Limpieza de release** (hooks + alwaysShowIntro) — Claude.
3. **Verificar en device** que arranca limpio (splash → onboarding una vez → grid), sin flujos rotos.
4. **Archive + upload a App Store Connect** — Kike (Xcode).
5. **Ficha + metadata + screenshots + privacy URL** en App Store Connect — Kike.
6. **TestFlight**: instalar, probar en device real, invitar a algún tester. → dispara tuit "testflight" (fire-when-real).
7. **Submit for review**. → tuit "submitted".
8. **Review** (aprobado o rechazo → iterar). → tuits "rejected" / "it's live".
9. **Publicado**. 🎉 Cierre del arco de build-in-public.

## Artefactos y rutas de referencia
- Metadata App Store: `ios/STORE_METADATA.md`
- Screenshots specs: `ios/SCREENSHOT_SPECS.md`
- Privacy policy (hospedar): `ios/PRIVACY_POLICY.md`
- Branding (fondos, ornamentos, rombo, icon, script): `branding/` (`backgrounds/`, `ornaments/`, `diamond-organic.svg`, `icons/`, `make_bg.py`)
- App icon actual: `ios/TileTales/TileTales/Assets.xcassets/AppIcon.appiconset/icon-1024.png` (tile #22 azul)
- Logo wordmark editable (naranja, recolorable): `~/Desktop/tile tales logo.svg`
- Splash final: Kike re-exporta imagen única (texto "COLLECTION" bien + azul `#3586F2`) → sustituir en `SplashImage.imageset`
- Estrategia/voz de X: `docs/X-BUILD-IN-PUBLIC.md` + memoria `feedback_x_writing_style` (voz nueva 2026-07-02)
- Estado técnico detallado: memoria `project_tiletales_next_ux_ios`
- Cola de X: Typefully social set `297990` (@kikelopezdesign)

## Post-lanzamiento (v2, NO ahora)
- Social = **mapa comunal geolocalizado** (no feed): `is_public` opt-in + RLS, likes/saves, ubicación difuminada, moderación. Ver memoria `project_tiletales_social_mapa_comunal`.
- Analítica personal (eventos Supabase o TelemetryDeck).
- Tab de Mapa: atlas de estilos de azulejo por país.
