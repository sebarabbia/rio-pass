# Rio Pass · Roadmap

El orden prioriza lo que antes valida el negocio en la puerta y deja para el final lo que necesita pagos reales.

## Etapa 1: Base del sistema (hecha)
Esquema completo con RLS, registro e inicio de sesión, web pública de eventos, perfil del cliente (datos, Mis tarjetas, Mis QR, Mis puntos) y panel del organizador para crear y publicar eventos con flyer.

## Etapa 2: Invitaciones QR, usuarios y temporadas (hecha)
- Panel → Usuarios: buscar por nombre/email y asignar roles (RRPP, acreditador, barra, organizador).
- Panel → Temporadas: crear y marcar la actual.
- Eventos con lugar, sectores (General / +25) y cupo de QR sin cargo por RRPP.
- Invitaciones QR emitidas por el organizador (sin límite) o por RRPP (con cupo, validado en la base), compartibles por WhatsApp con un link `/qr/<código>` que el invitado abre sin cuenta. Si el email tiene cuenta, aparece en "Mis QR".
- Fechas de ejemplo cargables desde el panel.

## Etapa 3: Acreditador (la puerta)
Evolución de la demo NFC (`docs/`):
- Una función SQL atómica `validar_acceso`: valida el QR (o la tarjeta), marca el QR como usado, registra la lectura en `access_scans` y crea la asistencia en `attendances`, todo en una sola transacción.
- Escaneo de QR con la cámara y de NFC por UID (tarjetas `generica`), con la pantalla verde/roja de la demo.
- Elegir el evento de la noche, ver el contador de ingresos y el historial.

## Etapa 4: Puntos y ranking
- Al validar un ingreso se suman `events.attendance_points` en `points_ledger` (una vez por evento; la base ya lo garantiza).
- Ranking por temporada con una función que expone solo nombre y total.
- Página de ranking y, en la cuenta, la posición del usuario. Premios al top 10 como movimientos `premio`.

## Etapa 5: Tarjetas NTAG 424 DNA
- Programar las tarjetas con SUN/SDM: al apoyarlas abren `https://…/t?picc=…&cmac=…`.
- Verificar del lado del servidor (Route Handler o Edge Function): descifrar el UID y el contador, validar el CMAC con claves diversificadas a partir de una clave maestra guardada como secreto (nunca en la base) y rechazar contadores repetidos (`last_counter`).
- Alta, asignación y bloqueo desde el panel.
- El tap muestra el pase del RRPP. Abrir la sesión completa solo con el tap tiene riesgos (tarjeta perdida = cuenta abierta), así que conviene que el tap muestre el pase y que la cuenta siga pidiendo contraseña en dispositivos nuevos.

## Etapa 6: Venta de entradas con Mercado Pago
- `ticket_types` con precio y cupo. La compra crea `orders` + `order_items` y una preferencia de Checkout Pro.
- Webhook de Mercado Pago (servidor, service role) → `payments` → cuando el pago queda aprobado, se emiten `tickets` con `order_id`.

## Etapa 7 (opcional): Bebidas y barra exprés
- Carta (`products`) y compra con Mercado Pago, igual que las entradas. El pedido pagado genera un `pickup_code` (QR).
- Rol barra: lista de pedidos pagados del evento; marcar como entregado (ya habilitado por RLS solo para ese cambio).
- Sumar puntos por compra (`points_ledger`, reason `compra`).
