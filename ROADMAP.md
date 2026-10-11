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

## Etapa 3: Puerta (acreditador) y tarjetas (hecha)
- Función atómica `validate_access`: valida QR (cámara o código tipeado) o tarjeta NFC por número de serie, marca el QR como usado, registra la lectura (`access_scans`) y la asistencia (`attendances`). Anti-passback: una tarjeta entra una vez por noche.
- Pantalla `/puerta` a pantalla completa: elegir la fecha, escanear QR con la cámara (lector nativo en Android, jsQR en iPhone), leer tarjetas NFC (Chrome Android), código a mano, resultado verde/rojo con el motivo, contador de ingresos y últimas lecturas.
- Panel → Tarjetas: cargar tarjetas (leyéndolas por NFC o tipeando el número), asignarlas a RRPP, bloquear y eliminar.

## Etapa 4: Puntos y ranking (hecha)
- Cada asistencia suma `events.attendance_points` (configurable por evento) en `points_ledger`, una vez por evento, con un trigger sobre `attendances`. La puerta muestra los puntos sumados.
- Invitados sin cuenta: al registrarse con el email de la invitación reciben la asistencia y los puntos.
- Ranking por temporada en dos ligas (clientes pública, RRPP interna) con funciones que exponen solo nombre corto y total. Página `/ranking`, podio en la home, puesto y movimientos en "Mi cuenta", estadística en el panel RRPP.
- Panel → Puntos: ranking completo y carga de premios/ajustes por persona.
- Pendiente para cuando termine la temporada: cerrar la temporada y registrar los premios del top 10 (hoy se ve el top 10 en el panel y se entregan a mano).

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
