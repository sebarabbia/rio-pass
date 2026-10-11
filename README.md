# Rio Pass

Plataforma web del boliche Rio (Paraná): eventos, cuentas, invitaciones QR, tarjetas NFC de RRPP, puntos y, a futuro, venta de entradas y bebidas. Ver [ROADMAP.md](ROADMAP.md).

## Stack

- **Next.js 16 (App Router, TypeScript)**: la mejor integración con Supabase (`@supabase/ssr`, login por cookies del lado del servidor), deploy en Vercel con HTTPS sin configuración y un solo proyecto para la web pública, los paneles y la lógica de servidor. Usa Cache Components: lo público se cachea y lo que depende de la sesión va dentro de `<Suspense>`.
- **Supabase**: Postgres + RLS, Auth y Storage (flyers). Proyecto `rio-pass` (ref `xupmwmmfdlumlvukoafa`, región São Paulo).
- **CSS propio** (`src/app/globals.css`) con la estética de marca: fondo `#2B3A3F`, logo vectorizado, Cormorant Garamond. Sin librerías de UI.
- **qrcode**: genera el QR (SVG) del lado del servidor.

## Estructura

```
docs/                        Demo NFC original (HTML estático, GitHub Pages)
supabase/migrations/         Esquema completo en SQL (ya aplicado al proyecto)
src/proxy.ts                 Refresca la sesión y protege /cuenta, /organizador, /rrpp y /puerta
src/lib/                     Clientes Supabase, auth (usuario + roles), eventos, ranking, fechas, QR, WhatsApp, NFC, imágenes
src/components/              Logo, header, tarjetas, formularios e invitaciones (compartidos)
src/demo/                    Fechas de ejemplo (flyers de la temporada pasada)
src/actions/                 Server Actions compartidas (invitaciones)
src/app/
  layout.tsx                 Documento, fuentes y estilos (sin menú)
  puerta/                    App de la puerta a pantalla completa (acreditador)
  auth/confirm/              Destino del link de confirmación por mail
  (sitio)/                   Todo lo que lleva menú y pie:
    page.tsx                 Home pública con próximas fechas
    eventos/[slug]/          Detalle público (lugar, sectores, cómo entrar)
    qr/[code]/               Pantalla del QR que recibe el invitado (link de WhatsApp)
    ranking/                 Ranking de la temporada (top 10 con premio, tu puesto)
    registro/, ingresar/     Alta e inicio de sesión (email + contraseña)
    recuperar/               "¿Olvidaste tu contraseña?" (manda el mail)
    cuenta/contrasena/       Elegir contraseña nueva (desde el mail o desde Mi cuenta)
    cuenta/                  Perfil: datos, Mis QR, Mis puntos (y Mis tarjetas si tiene)
    rrpp/                    Panel RRPP: fechas, cupo, generar y compartir QR sin cargo
    organizador/             Panel: eventos, invitaciones, usuarios y roles, tarjetas NFC,
                             puntos y ranking, temporadas, fechas de ejemplo
```

## Correrlo localmente

Requisitos: Node 20+.

```bash
npm install
cp .env.example .env.local   # URL y publishable key de Supabase
npm run dev                  # http://localhost:3000
```

Otros comandos: `npm run build`, `npm run lint`, `npm run typecheck`, `npm run db:types` (regenera los tipos; requiere `npx supabase login`).

## Base de datos

Las migraciones en `supabase/migrations/` ya están aplicadas al proyecto `rio-pass`. Para otro proyecto: `npx supabase link --project-ref <ref>` y `npx supabase db push` (o pegarlas en orden en el SQL Editor).

- **Roles** (`user_roles`): cliente, rrpp, organizador, acreditador, barra. Un usuario puede tener varios. Todo usuario nuevo nace `cliente`; el organizador asigna el resto desde **Panel → Usuarios**.
- **Tablas**: `profiles`, `seasons`, `events`, `ticket_types` (sectores), `tickets` (QR), `nfc_cards`, `access_scans`, `attendances`, `points_ledger`, `products`, `orders`, `order_items`, `payments`. Todas con RLS.
- **Funciones** (validan permisos por dentro, por eso el asesor de Supabase las marca como "SECURITY DEFINER ejecutable", es intencional):
  - `issue_invitation`: emite un QR. Organizador sin límite; RRPP solo en fechas publicadas y dentro de su cupo (`events.rrpp_invite_quota`), de forma atómica.
  - `void_ticket`: anula un QR sin usar (el RRPP solo los suyos).
  - `get_ticket_by_code`: datos públicos de un QR a partir de su código (sin email ni teléfono).
  - `validate_access`: valida un ingreso en la puerta (QR, código o tarjeta NFC) de forma atómica.
  - `door_stats`: contador de ingresos de la noche.
  - `season_ranking`: ranking de la temporada (solo nombre corto y total; la liga RRPP solo para RRPP y organizadores).
  - `my_ranking`: puntos, puesto y distancia al top 10 del usuario logueado.
  - `admin_season_ranking`: ranking con nombre completo y contacto, solo organizador.
  - `search_door_guests`: busca QR de un evento por nombre del titular, solo acreditador u organizador.
- Auxiliares en el esquema `private` (no expuesto por la API).

## Invitaciones QR (Etapa 2)

1. El organizador marca a alguien como **RRPP** en Panel → Usuarios.
2. El RRPP entra a **/rrpp**, elige la fecha, carga nombre (y opcionalmente celular, email y sector) y toca **Generar QR**.
3. Comparte por **WhatsApp** el link `/qr/<código>`: ahí el invitado ve su QR, sin necesidad de cuenta. Si cargó un email que tiene cuenta (o se registra después con ese email), el QR también aparece en su "Mis QR".
4. El QR codifica ese mismo link: la app de puerta (Etapa 3) va a leer el código de ahí.

Cada fecha tiene un cupo de QR por RRPP (editable en el evento); anular un QR sin usar libera el lugar. El organizador puede emitir y ver todas las invitaciones de un evento en **Panel → Eventos → Invitaciones**.

## Puerta (Etapa 3)

1. El organizador asigna el rol **Acreditador** al personal de puerta (Panel → Usuarios) y carga las tarjetas de los RRPP (Panel → Tarjetas: se pueden leer apoyándolas en un Android con Chrome).
2. En la puerta se abre **/puerta** desde el celular, se elige la fecha y se toca **Escanear QR** (cámara) o **Leer tarjetas NFC** (solo Chrome en Android). También se puede tipear el código.
3. Cada lectura muestra pantalla completa verde (con nombre y sector) o roja con el motivo: ya usado (y a qué hora), otra fecha, anulado, QR no válido, tarjeta bloqueada / sin asignar / no reconocida, o ya ingresó esta noche.
4. Los QR son de un solo uso. Las tarjetas entran una vez por noche (anti-passback). Cada ingreso queda registrado como asistencia, que es la base de los puntos (Etapa 4).

## Puntos y ranking (Etapa 4)

- Cada ingreso validado en la puerta de alguien con cuenta suma los **puntos del evento** (`events.attendance_points`, 10 por defecto; se cambia en el formulario del evento). Una vez por evento, en la temporada del evento (si no tiene, la que incluye su fecha, o la actual). Lo hace un trigger sobre `attendances`, así que vale para QR y tarjetas.
- Un invitado que entró con QR **sin cuenta** recibe esos puntos cuando se registra con el email de la invitación.
- **Dos ligas**: clientes (pública, en `/ranking` y en la home) y RRPP (interna: la ven solo RRPP y organizadores; un cliente no sabe que existe). Los RRPP vienen todas las noches con su tarjeta y se quedarían con el premio de los clientes.
- El ranking público muestra solo "Nombre I." y el total. A igual puntaje va primero quien llegó antes a ese total, así el top 10 nunca queda empatado.
- **Mi cuenta → Mis puntos**: total, puesto, cuánto falta para el top 10 y últimos movimientos. La puerta muestra "+10 puntos" al validar.
- **Panel → Puntos**: ranking completo por temporada y liga; en cada persona, sus movimientos y un formulario para cargar un **premio** (bonus) o un **ajuste** (+/-, con nota). Los movimientos no se borran: se corrigen con otro en sentido contrario.

## Configuración de Auth (una vez, en el dashboard de Supabase)

1. **Registro sin fricción:** Authentication → Sign In / Providers → Email → desactivar *Confirm email*.
2. **URLs:** Authentication → URL Configuration → Site URL = `https://rio-pass.vercel.app` y en Redirect URLs agregar `https://rio-pass.vercel.app/**` y `http://localhost:3000/**` (los links de los mails vuelven a `/auth/confirm?next=…`).
3. **Mails (obligatorio para "¿Olvidaste tu contraseña?"):** el servidor de mail que trae Supabase solo manda a los miembros del equipo del proyecto y unos pocos por hora, así que a los clientes no les llega. Configurar SMTP propio, por ejemplo con [Resend](https://resend.com) (gratis hasta 3000 mails/mes):
   1. Crear la cuenta en Resend, verificar un dominio (o usar el de prueba) y crear una API key.
   2. Supabase → Authentication → Emails → SMTP Settings → *Enable custom SMTP*: host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = la API key, remitente `Rio <no-responder@tu-dominio>`.
   3. En Authentication → Rate Limits subir el límite de mails por hora (por ejemplo a 100).
   4. Opcional: traducir la plantilla *Reset password* (Authentication → Emails → Templates).
4. **Teléfono:** el login por SMS requiere un proveedor pago (Twilio, etc.). Por ahora el celular es un dato del perfil y el login es por email.
5. **Opcional:** activar *Leaked password protection* (Authentication → Policies) si el plan lo permite.

## Primer organizador

Registrate en la web y, en el SQL Editor de Supabase:

```sql
insert into public.user_roles (user_id, role)
select id, 'organizador' from auth.users where email = 'TU_EMAIL@ejemplo.com'
on conflict do nothing;
```

Volvé a entrar: aparece **Panel** en el menú. Desde ahí se asignan los demás roles.

## Fechas de ejemplo

**/organizador/demo** (ya no tiene botón en el panel) carga 3 fechas publicadas con flyers reales (Apertura, Rio Tropical, Old School) en los viernes del verano 2027, más la temporada "Verano 2027". Se suben con la sesión del organizador (mismas reglas que una carga a mano) y se borran con un botón sin tocar los eventos reales.

## Detalles de UX

- **Vista previa en WhatsApp:** cada link (home, evento, QR) tiene una imagen 1200×630 generada en el servidor (`opengraph-image.tsx` + `lib/og.tsx`) con el flyer pasado a JPEG (los flyers se guardan en WebP y el generador no los lee).
- **App instalable:** `app/manifest.ts` (Rio Pass) y `public/puerta.webmanifest` (Rio Puerta, abre directo en `/puerta`). En Android: menú de Chrome → *Agregar a pantalla de inicio*; en iPhone: Compartir → *Agregar a inicio*.
- **Puerta:** buscar invitados por nombre (`search_door_guests`, sin acentos ni mayúsculas) para dar ingreso sin el QR, y aviso si la fecha elegida no es la de hoy.
- **Avisos "✓ Listo"** en las acciones del panel (`components/ActionForm` + `components/Toast`).

## Deploy (Vercel)

Producción: **https://rio-pass.vercel.app** (proyecto `rio-pass` en Vercel, funciones en São Paulo `gru1` junto a la base de datos, ver `vercel.json`).

1. En [vercel.com/new](https://vercel.com/new), importar el repo `sebarabbia/rio-pass` (rama `main`) y tocar **Deploy**. No hace falta cargar variables: la URL y la publishable key de Supabase son públicas y están en `src/lib/supabase/config.ts` (se pueden pisar con `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
2. Opcional: `NEXT_PUBLIC_SITE_URL` con la URL final, si se usa un dominio propio para los links de los QR.
3. En Supabase → Authentication → URL Configuration: Site URL = la URL de Vercel, y agregar `<url>/auth/confirm` a Redirect URLs.

Cada push a `main` se publica solo. La demo NFC sigue en GitHub Pages, servida desde `docs/`.
