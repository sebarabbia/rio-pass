# Rio Pass

Plataforma web del boliche Rio (Paraná): eventos, cuentas, QR, tarjetas NFC de RRPP, puntos y, a futuro, venta de entradas y bebidas. Las etapas están en [ROADMAP.md](ROADMAP.md).

## Stack

- **Next.js 16 (App Router, TypeScript)**: es la opción con mejor integración con Supabase (`@supabase/ssr`, con login por cookies en el servidor), corre en Vercel con HTTPS sin configurar nada y mantiene todo (web pública, panel y lógica de servidor) en un solo proyecto. Usa Cache Components: lo público se cachea y lo que depende de la sesión va dentro de `<Suspense>`.
- **Supabase**: Postgres con RLS, Auth y Storage (flyers). Proyecto `rio-pass` (ref `xupmwmmfdlumlvukoafa`, región São Paulo).
- **CSS propio** (`src/app/globals.css`) con la estética de marca: fondo `#2B3A3F`, logo vectorizado y Cormorant Garamond. No hay librerías de UI.

## Estructura

```
docs/                    Demo NFC original (HTML estático, GitHub Pages)
supabase/migrations/     Esquema completo en SQL (ya aplicado al proyecto)
src/proxy.ts             Refresca la sesión y protege /cuenta y /organizador
src/lib/                 Clientes Supabase, auth (usuario + roles), eventos, formato de fechas, tipos
src/components/          Logo, header, tarjeta de evento, botones
src/app/                 Páginas:
  page.tsx                 Home pública con próximas fechas
  eventos/[slug]/          Detalle público del evento
  registro/, ingresar/     Alta e inicio de sesión (email + contraseña)
  auth/confirm/            Destino del link de confirmación por mail
  cuenta/                  Perfil: datos, Mis tarjetas, Mis QR, Mis puntos
  organizador/             Panel: crear, editar, publicar y eliminar eventos con flyer
```

## Correrlo localmente

Requisitos: Node 20 o superior.

```bash
npm install
cp .env.example .env.local   # completar con URL y publishable key (ya viene armado en esta máquina)
npm run dev                  # http://localhost:3000
```

Otros comandos: `npm run build`, `npm run lint`, `npm run typecheck` y `npm run db:types` (regenera los tipos; antes hay que correr `npx supabase login`).

## Base de datos

Las migraciones de `supabase/migrations/` ya están aplicadas al proyecto `rio-pass`. Para otro proyecto: `npx supabase link --project-ref <ref>` y después `npx supabase db push`, o pegarlas en orden en el SQL Editor.

- **Roles** (`user_roles`): cliente, rrpp, organizador, acreditador y barra. Un usuario puede tener varios, y todo usuario nuevo nace como `cliente` (trigger en `auth.users`).
- **Tablas**: `profiles`, `seasons`, `events`, `ticket_types`, `tickets` (QR), `nfc_cards`, `access_scans`, `attendances`, `points_ledger`, `products`, `orders`, `order_items` y `payments`. Todas tienen RLS.
- **Funciones auxiliares** en el esquema `private`, que no queda expuesto por la API.

## Configuración de Auth (una vez, en el panel de Supabase)

1. **Registro sin fricción:** en Authentication → Sign In / Providers → Email, desactivá *Confirm email*. Si queda activado, el servidor de mail de Supabase tiene límites muy bajos y solo entrega a direcciones del equipo. Para producción conviene configurar un SMTP propio (por ejemplo Resend).
2. **URLs:** en Authentication → URL Configuration, Site URL = `http://localhost:3000` (en producción, la URL de Vercel), y agregar `<url>/auth/confirm` a Redirect URLs.
3. **Login por teléfono:** requiere un proveedor de SMS pago (Twilio, etc.). Por ahora el celular se guarda como dato del perfil y el login es por email.

## Crear el primer organizador

1. Registrate en la web.
2. En el SQL Editor de Supabase:

```sql
insert into public.user_roles (user_id, role)
select id, 'organizador' from auth.users where email = 'TU_EMAIL@ejemplo.com'
on conflict do nothing;
```

3. Volvé a entrar: vas a ver **Panel** en el menú. Desde ahí creás y publicás eventos.

## Deploy (Vercel)

Importar el repo en Vercel, cargar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, y actualizar la Site URL en Supabase.
