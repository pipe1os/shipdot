---
title: Sincroniza lo leído entre dispositivos
---
Si tu app tiene cuentas de usuario, las entradas que un usuario leyó en un dispositivo pueden seguir leídas en los demás. Guarda los IDs del evento `shipdot:read` en tu servidor y devuélvelos con `markRead(ids)`. shipdot sigue sin enviar nada: los IDs los guarda tu app.
