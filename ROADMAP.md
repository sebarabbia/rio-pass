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

## Auditoría UX/UI (hecha)
Recuperar y cambiar contraseña, vista previa con flyer en los links de WhatsApp, consejo de sacar captura al QR, home más compacta con botones según la sesión, "Tu próxima entrada" en Mi cuenta, RRPP con compartir nativo, panel de eventos con próximas/anteriores y números por noche, búsqueda por nombre y aviso de fecha en la puerta, compartir y "Cómo llegar" en cada evento, avisos "Listo" en el panel, textos de 12 px mínimo, panel más ancho en compu y app instalable (sitio y puerta).

## Etapa 5: RRPP a escala y perfiles (hecha)
- Un solo perfil por persona (cliente, RRPP, acreditador, organizador); todos ven lo de cliente.
- Alta masiva de RRPP con su organizador responsable; cada organizador ve por defecto su grupo.
- Habilitación de QR por fecha después de la primera difusión, QR propio intransferible, QR extra, tope total por fecha (1000) y email obligatorio con creación automática de cuenta.
- Puerta en azul para RRPP; contador público de QR entregados en cada fecha; tarjetas NFC asignables a cualquier cliente.

## Etapa 6: Tarjetas NTAG 424 DNA (para vender a clientes)
- Programar las tarjetas con SUN/SDM: al apoyarlas abren `https://…/t?picc=…&cmac=…`.
- Verificar del lado del servidor (Route Handler o Edge Function): descifrar el UID y el contador, validar el CMAC con claves diversificadas a partir de una clave maestra guardada como secreto (nunca en la base) y rechazar contadores repetidos (`last_counter`).
- Alta, asignación y bloqueo desde el panel.
- El tap muestra el pase del RRPP. Abrir la sesión completa solo con el tap tiene riesgos (tarjeta perdida = cuenta abierta), así que conviene que el tap muestre el pase y que la cuenta siga pidiendo contraseña en dispositivos nuevos.

## Etapa 7: Venta de entradas con Mercado Pago (hecha; falta cargar las credenciales)
- Precio, cupo online y ventana de venta por sector desde **Panel → Ventas**.
- Compra en la página de la fecha (hasta 6 entradas, reserva de 15 minutos) con Checkout Pro; el precio y el total se calculan en la base.
- Webhook de Mercado Pago (Edge Function `pagos`): siempre se consulta el pago en la API y se aplica con `apply_mp_payment` (idempotente, controla monto, moneda, duplicados, devoluciones, contracargos y sobreventa). Respaldo si el aviso no llega: al volver a la web, en Mi cuenta y con "Revisar pago".
- QR en Mi cuenta, pasar una entrada a otra persona por email (el QR cambia), devolución desde el panel y resumen de lo recaudado.
- Pendiente: venta de tarjetas (cuando esté la Etapa 6).

## Etapa 8 (opcional): Bebidas y barra exprés
- Carta (`products`) y compra con Mercado Pago, igual que las entradas. El pedido pagado genera un `pickup_code` (QR).
- Rol barra: lista de pedidos pagados del evento; marcar como entregado (ya habilitado por RLS solo para ese cambio).
- Sumar puntos por compra (`points_ledger`, reason `compra`).
