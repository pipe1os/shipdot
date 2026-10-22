---
title: Sincronize o que foi lido entre dispositivos
---
Se o seu app tem contas de usuário, as entradas que um usuário leu em um dispositivo podem continuar lidas nos outros. Guarde os IDs do evento `shipdot:read` no seu servidor e devolva-os com `markRead(ids)`. O shipdot continua sem enviar nada: quem guarda os IDs é o seu app.
