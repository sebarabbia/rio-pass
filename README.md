# Rio Pass — demo

Prueba de concepto del control de acceso por tarjetas NFC para RRPP de Rio.
No es la versión final: sin backend, sin login, datos guardados solo en el navegador (`localStorage`).

- **Puerta:** "Escanear tarjeta" activa el lector NFC; cada tarjeta muestra ACCESO PERMITIDO (verde) o TARJETA NO RECONOCIDA (rojo) y vuelve sola a quedar lista.
- **Administración:** alta de RRPP (apoyando la tarjeta o escribiendo el número de serie), bloquear/habilitar, eliminar, contador de ingresos y actividad reciente.

La lectura usa la Web NFC API (`NDEFReader`) y solo lee el número de serie (`serialNumber`) de la tarjeta; nunca escribe.
Funciona únicamente en **Chrome para Android** y sobre **HTTPS**. En otros dispositivos se puede probar la lógica con la carga manual.

Todo el código está en `index.html`.
