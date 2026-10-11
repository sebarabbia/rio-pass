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
src/proxy.ts                 Refresca la sesión y protege /cuenta, /organizador y /rrpp
src/lib/                     Clientes Supabase, auth (usuario + roles), eventos, fechas, QR, WhatsApp
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
    registro/, ingresar/     Alta e inicio de sesión (email + contraseña)
    cuenta/                  Perfil: datos, Mis QR, Mis puntos (y Mis tarjetas si tiene)
    rrpp/                    Panel RRPP: fechas, cupo, generar y compartir QR sin cargo
    organizador/             Panel: eventos, invitaciones, usuarios y roles, tarjetas NFC,
                             temporadas, fechas de ejemplo
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

## Configuración de Auth (una vez, en el dashboard de Supabase)

1. **Registro sin fricción:** Authentication → Sign In / Providers → Email → desactivar *Confirm email*. (Si queda activo, el mail de Supabase tiene límites muy bajos; para producción configurar SMTP propio, p. ej. Resend.)
2. **URLs:** Authentication → URL Configuration → Site URL = `http://localhost:3000` (en producción, la URL de Vercel) y agregar `<url>/auth/confirm` a Redirect URLs.
3. **Teléfono:** el login por SMS requiere un proveedor pago (Twilio, etc.). Por ahora el celular es un dato del perfil y el login es por email.
4. **Opcional:** activar *Leaked password protection* (Authentication → Policies) si el plan lo permite.

## Primer organizador

Registrate en la web y, en el SQL Editor de Supabase:

```sql
insert into public.user_roles (user_id, role)
select id, 'organizador' from auth.users where email = 'TU_EMAIL@ejemplo.com'
on conflict do nothing;
```

Volvé a entrar: aparece **Panel** en el menú. Desde ahí se asignan los demás roles.

## Fechas de ejemplo

**Panel → Fechas de ejemplo** carga 3 fechas publicadas con flyers reales (Apertura, Rio Tropical, Old School) en los viernes del verano 2027, más la temporada "Verano 2027". Se suben con la sesión del organizador (mismas reglas que una carga a mano) y se borran con un botón sin tocar los eventos reales.

## Deploy (Vercel)

Producción: **https://rio-pass.vercel.app** (proyecto `rio-pass` en Vercel, funciones en São Paulo `gru1` junto a la base de datos, ver `vercel.json`).

1. En [vercel.com/new](https://vercel.com/new), importar el repo `sebarabbia/rio-pass` (rama `main`) y tocar **Deploy**. No hace falta cargar variables: la URL y la publishable key de Supabase son públicas y están en `src/lib/supabase/config.ts` (se pueden pisar con `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
2. Opcional: `NEXT_PUBLIC_SITE_URL` con la URL final, si se usa un dominio propio para los links de los QR.
3. En Supabase → Authentication → URL Configuration: Site URL = la URL de Vercel, y agregar `<url>/auth/confirm` a Redirect URLs.

Cada push a `main` se publica solo. La demo NFC sigue en GitHub Pages, servida desde `docs/`.
