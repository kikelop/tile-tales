# Tile Tales — Radar de contenido X

Captura de momentos con valor de tuit (build in public) **mientras se trabaja en la app**, para que no se pierdan. Kike los olvida → se anotan aquí en el momento y se sueltan en un checkpoint. El arco/estrategia y la voz viven en `X-BUILD-IN-PUBLIC.md`. La cuenta va a 2 carriles (Tile Tales + Playground), ver `~/workspace/personal/career/x-content/plan-2-carriles.md`.

## La regla (cómo funciona)

1. **Durante cualquier sesión de trabajo en Tile Tales**, detectar momentos content-worthy y anotarlos abajo como candidato (1 línea + ángulo + categoría). Sin interrumpir el trabajo.
2. **En el checkpoint** (fin de sesión, o cuando pasa algo gordo): soltar un "esto daría para tuit: X, Y" y dejar que Kike elija. No recordar a cada rato.
3. Kike elige → se desarrolla en borrador (Typefully / `x-content/`) y se marca aquí.
4. **Prioridad TT > Playground.** El contenido real de Tile Tales (mejoras + proceso App Store) manda. Para colocar un post TT fresco, meterlo en el hueco más cercano y **empujar hacia delante** (a fecha posterior) el experiment de Playground que ocupara ese slot. Los experiments son relleno elástico: se retrasan, nunca se pierden.

**Qué cuenta como candidato:** hito · blocker · bug · "no sabía que había que X" · decisión de diseño no obvia · rejection/setback · batallita del pasado (vale rescatar cosas viejas).

**Regla de honestidad (heredada del BIP):** los hitos solo se programan con fecha cuando son ciertos. Hasta entonces viven aquí como candidato o como borrador FIRE-WHEN-REAL sin fecha.

Estados: `idea` → `drafted` → `scheduled` → `posted`.

---

## Backlog

### Hitos del viaje a la App Store (muchos ya como borrador FIRE-WHEN-REAL)
| Candidato | Ángulo | Estado |
|---|---|---|
| enrolarse en Apple Developer Program | cuenta atada a sociedad ornitológica de hace 4 años 🐦, el primer blocker es papeleo | **scheduled** (07-06) |
| pagar los 99€ + crear perfil App Store Connect | "ok, decidido, pagados los 99, deja de ser side project" + lo que no sabías que pedían al montar el perfil (privacy policy URL, categorías, etc.) | draft FIRE-WHEN-REAL "paid the 99" — ampliar con el setup del perfil |
| build corriendo en el móvil de verdad | no una pestaña fingiendo ser app | draft FIRE-WHEN-REAL "first build" + es el hito del hilo tour |
| primer tester en TestFlight | primera persona que no soy yo | draft FIRE-WHEN-REAL |
| icono + screenshots de store | el terreno del diseñador | draft FIRE-WHEN-REAL |
| submitted to review | botón pulsado, "waiting for review" | draft FIRE-WHEN-REAL |
| rejected | qué dijo Apple y por qué | draft FIRE-WHEN-REAL |
| it's live | el recuento: semanas, 99€, rejections, bugs | draft FIRE-WHEN-REAL |

### Blockers / "no sabía que…"
| Candidato | Ángulo | Estado |
|---|---|---|
| getUserMedia muere en PWA standalone | la cámara es el core; webkit la silencia sin avisar → razón real para ir nativo | draft FIRE-WHEN-REAL "the camera wall" |
| montar App Store Connect | lo que nadie te cuenta que hace falta antes de poder subir nada | idea (capturar al hacerlo) |

### Decisiones de diseño (evergreen, text-only, RELLENO del carril M/X/V — se sustituyen por contenido fresco cuando aparece)
| Candidato | Ángulo | Estado |
|---|---|---|
| maté el swipe entre tiles | chocaba con rotar el 3D al arrastrar; dos gestos peleando por un drag | **scheduled** 07-08 |
| quité el dark mode a propósito | los tiles son el color, la UI se aparta | **scheduled** 07-10 |
| rebrand: wordmark + patrón azulejo + paleta | de "mi prototipo" a algo que enseñar | **scheduled** 07-13 |
| visor 3d nativo con scenekit + flip para leer el recuerdo detrás | en presente, sin comparación web (ya pasamos esa fase) | **scheduled** 07-15 |
| editar la foto de un tile DESPUÉS (luz / recrop), no destructivo | por si la sacaste mal, puedes rehacerla | **scheduled** 07-17 |
| splash screen como toque de branding | el primer segundo marca el tono | **scheduled** 07-20 |

> ⚠️ **La app es FULL NATIVO iOS ahora — no asumir features del app web viejo.** Dos placeholders salieron falsos (batch-import, "splash de tus tiles recoloreados") por copiarlos del web. Antes de afirmar una feature en un tuit, verificar que existe en nativo (o preguntar a Kike). La narrativa web→nativo ya está gastada; hablar en presente de la app nativa.
| "wallpaper" → "compose" | el nombre encajonaba la feature | **scheduled** 07-22 · ⚠ solapa con tuit 5 del tour |

> Estos 7 son el **suelo** del carril TT en julio: si sale un tuit de proceso real, se sustituye el del día por ese (editar el borrador programado en Typefully). Al publicar el tour, quitar los 3 marcados ⚠ para no repetir.

---

## Pendiente inmediato (lo que sabe Kike que tiene que hacer)
- **Grabar media del hilo "native rebuild tour"** (8 tuits, hoy sin capturas): al menos colección / visor 3D / mapa / compose. Sin esto el hilo no sale. Ver `X-BUILD-IN-PUBLIC.md`.
- Siguiente paso real de la app: **crear perfil App Store + pagar 99€** → dispara "paid the 99".
