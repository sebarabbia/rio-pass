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
    compra/[orderId]/        Vuelta de Mercado Pago: estado del pago y las entradas compradas
    registro/, ingresar/     Alta e inicio de sesión (email + contraseña)
    recuperar/, activar/     Recuperar contraseña o activar una cuenta creada por Rio (manda el mail)
    cuenta/contrasena/       Elegir contraseña nueva (desde el mail o desde Mi cuenta)
    cuenta/                  Perfil: datos, Mis QR, Mis puntos (y Mis tarjetas si tiene)
    rrpp/                    Panel RRPP: fechas, cupo, generar y compartir QR sin cargo
    organizador/             Panel: eventos (QR y RRPP por fecha), RRPP (alta masiva y
                             responsables), usuarios y perfiles, tarjetas NFC, puntos y
                             ranking, temporadas
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
  - `set_user_profile`, `set_rrpp_manager`, `set_rrpp_access`, `event_rrpp_board`: perfiles, responsables y habilitación de RRPP (organizador).
  - `rrpp_event_status`: estado del RRPP en cada fecha (habilitado, cupo, tope, su QR).
  - `event_going_counts`: contador público de QR entregados por fecha.
- **Edge Function `pagos`** (`supabase/functions/pagos`): Mercado Pago Checkout Pro (crear el pago, webhook, consultar, devolver y pasar entradas). Funciones de la base solo para el servidor: `create_ticket_order`, `apply_mp_payment`, `transfer_ticket`; públicas: `event_ticket_offer`; organizador: `event_sales_summary`.
- **Edge Function `cuentas`** (`supabase/functions/cuentas`): crea cuentas sin contraseña (QR regalados a emails nuevos y alta masiva de RRPP). Verifica por dentro la sesión y el perfil de quien llama.
- Auxiliares en el esquema `private` (no expuesto por la API).

## Perfiles

Cada persona tiene **una sola cuenta y un solo perfil** (se cambia en Panel → Usuarios). Todos ven lo de cliente (próximas fechas, sus QR, sus puntos) y el perfil suma lo suyo:

| Perfil | Qué suma |
| --- | --- |
| Cliente | Nada más: fechas, sus QR, puntos y ranking (a futuro, su tarjeta NFC comprada). |
| RRPP | Panel RRPP: su QR propio por fecha y QR para regalar. Ranking de RRPP. |
| Acreditador | La puerta (`/puerta`). |
| Organizador | Todo el panel, la puerta y QR sin límite. |

## RRPP e invitaciones QR

1. **Alta:** Panel → RRPP → *Cargar RRPP*: se pega la lista de Excel/Sheets (nombre, email, celular). Se crea la cuenta de cada uno (Edge Function `cuentas`, con la clave de servicio que solo vive en Supabase) y queda a cargo del organizador elegido. Cada RRPP activa su cuenta en **/activar** eligiendo su contraseña.
2. **Habilitación por fecha:** Panel → Eventos → **RRPP**: cada organizador ve por defecto su grupo y habilita a quienes hicieron la primera difusión (de a uno o todos los de la lista). Al habilitar se crea el **QR propio** del RRPP (intransferible, en su cuenta). Se pueden dar **QR extra** (+1) a quien se lo merece y avisarle por WhatsApp.
3. **Cupo y tope:** cada RRPP habilitado tiene `events.rrpp_invite_quota` QR (5, incluye el suyo) + extra. La fecha tiene un **tope total** (`events.rrpp_total_cap`, 1000): al llegar, nadie puede regalar más. Los QR de los organizadores no tienen límite ni cuentan para el tope. Todo se valida en la base (`issue_invitation`, con bloqueo por fecha).
4. **Regalar un QR:** nombre y **email obligatorios** (una persona, un QR por fecha). Si el email no tiene cuenta, se le crea una y el QR queda ahí; la persona la activa en /activar. Se comparte por WhatsApp u otra app con el link `/qr/<código>`.
5. **Control:** Panel → Eventos → **QR**: todos los QR entregados de la fecha, con búsqueda, filtro (organizadores / RRPP / un RRPP) y anulación.

En la web, cada fecha muestra cuántos QR se entregaron ("🔥 N ya tienen su QR", desde 15).

## Puerta (Etapa 3)

1. El organizador asigna el rol **Acreditador** al personal de puerta (Panel → Usuarios) y carga las tarjetas de los RRPP (Panel → Tarjetas: se pueden leer apoyándolas en un Android con Chrome).
2. En la puerta se abre **/puerta** desde el celular, se elige la fecha y se toca **Escanear QR** (cámara) o **Leer tarjetas NFC** (solo Chrome en Android). También se puede tipear el código.
3. Cada lectura muestra pantalla completa verde (con nombre y sector), **azul si es un RRPP**, o roja con el motivo: ya usado (y a qué hora), otra fecha, anulado, QR no válido, tarjeta bloqueada / sin asignar / no reconocida, o ya ingresó esta noche.
4. Los QR son de un solo uso. Las tarjetas entran una vez por noche (anti-passback). Cada ingreso queda registrado como asistencia, que es la base de los puntos (Etapa 4).

## Puntos y ranking (Etapa 4)

- Cada ingreso validado en la puerta de alguien con cuenta suma los **puntos del evento** (`events.attendance_points`, 10 por defecto; se cambia en el formulario del evento). Una vez por evento, en la temporada del evento (si no tiene, la que incluye su fecha, o la actual). Lo hace un trigger sobre `attendances`, así que vale para QR y tarjetas.
- Un invitado que entró con QR **sin cuenta** recibe esos puntos cuando se registra con el email de la invitación.
- **Dos ligas**: clientes (pública, en `/ranking` y en la home) y RRPP (interna: la ven solo RRPP y organizadores; un cliente no sabe que existe). Los RRPP vienen todas las noches con su tarjeta y se quedarían con el premio de los clientes.
- El ranking público muestra solo "Nombre I." y el total. A igual puntaje va primero quien llegó antes a ese total, así el top 10 nunca queda empatado.
- **Mi cuenta → Mis puntos**: total, puesto, cuánto falta para el top 10 y últimos movimientos. La puerta muestra "+10 puntos" al validar.
- **Panel → Puntos**: ranking completo por temporada y liga; en cada persona, sus movimientos y un formulario para cargar un **premio** (bonus) o un **ajuste** (+/-, con nota). Los movimientos no se borran: se corrigen con otro en sentido contrario.

## Venta de entradas (Mercado Pago)

**Cómo funciona**
1. **Panel → Eventos → Ventas:** cada sector (los del evento) se vende online si tiene precio. Se carga el precio, el cupo online (vacío = sin límite) y, opcional, cuándo empieza y termina la venta (si no, hasta 4 h después de que empieza la fecha).
2. **En la página de la fecha** aparece "Entradas": el cliente (con cuenta) elige sectores y cantidades (hasta 6), se le **reservan 15 minutos** y paga en Mercado Pago (Checkout Pro: tarjeta o dinero en cuenta; sin efectivo, porque se acredita tarde).
3. Al aprobarse el pago, los QR aparecen en **Mi cuenta** (y en `/compra/<id>`, la pantalla a la que vuelve desde Mercado Pago). Cada entrada se puede **pasar a otra persona** por email (se le crea la cuenta si no tiene; el código del QR cambia).
4. **Panel → Ventas** muestra lo recaudado, vendidas por sector y las compras. Desde ahí se puede **devolver** una compra (Mercado Pago devuelve la plata y los QR sin usar se anulan) o volver a consultar un pago.

**Seguridad:** las credenciales viven solo en los secretos de Supabase (Edge Function `pagos`). El precio y el total se calculan en la base, nunca en el navegador. Ante cada aviso de Mercado Pago se consulta el pago en su API con nuestro token (fuente de verdad) y se aplica con `apply_mp_payment`, que es idempotente y verifica monto y moneda: un aviso falso no puede emitir entradas. La firma de los avisos se controla y, si no coincide, queda en los logs (suele ser la clave mal cargada) pero el pago se aplica igual, para que nadie se quede sin sus QR. Si un aviso no llega, el pago se aplica igual cuando el cliente vuelve a la web, cuando abre Mi cuenta o con "Revisar pago" en el panel.

**Configuración (una vez)**
1. En [Mercado Pago Developers → Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) creá una aplicación de **Checkout Pro** (pagos online). Al crearla te da las **credenciales de prueba** y una cuenta vendedora de prueba.
2. En la aplicación, **Webhooks → Configurar notificaciones**: cargá la misma URL en **"URL modo pruebas"** y en **"URL modo productivo"**: `https://xupmwmmfdlumlvukoafa.supabase.co/functions/v1/pagos/webhook`, marcá el evento **Pagos**, guardá y copiá la **clave secreta**. (Los pagos de prueba solo avisan a esta URL del panel.)
3. En Supabase → **Edge Functions → Secrets** cargá:
   - `MP_ACCESS_TOKEN` = el Access Token (primero el de prueba).
   - `MP_WEBHOOK_SECRET` = la clave secreta de los webhooks.
   - `MP_TEST_MODE` = `true` mientras uses credenciales de prueba.
4. Probá una compra: abrí la web en una ventana de incógnito, pagá con la cuenta **compradora de prueba** y una tarjeta de prueba (titular `APRO` para aprobado, `OTHE` para rechazado).
5. Para vender de verdad: completá los datos de tu cuenta de Mercado Pago, reemplazá `MP_ACCESS_TOKEN` por el de **producción** y borrá `MP_TEST_MODE` (o ponelo en `false`). Revisá que la URL de webhooks esté cargada también en modo productivo.

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

## Diseño ("Rio de noche, como afiche")

- **Tipografías:** Cormorant Garamond (la serif del logo) en tamaños monumentales y en *itálica* para acentuar palabras; Archivo para texto, con las etiquetas angostas (`font-stretch`) como en un afiche.
- **Paleta** (`:root` en `globals.css`): pizarra `#2B3A3F` (marca), noche `#1B2629` (bandas de contraste), hueso `#F1ECE3` (secciones claras, entradas de papel) y un solo acento, arena `#E2C58C`, usado con moderación.
- **Recursos:** grano de película sutil, la línea del río (`components/RiverLine`), marquesina de fechas (`components/Marquee`), la próxima fecha como afiche con marco de papel, agenda editorial con índices y filetes, QR como entrada con troquel y pie con el logo gigante recortado.
- **Movimiento:** entrada escalonada en la primera pantalla y aparición al scrollear solo con CSS (`animation-timeline: view()`, sin librerías). Todo se apaga con "reducir movimiento".

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
