# Órgano piloto — Sincronía Nexus Presencia

Contrato operativo del primer órgano del ecosistema: **una presencia** (Nexus) con skills hacia salud mental/física, encuentro social (ContacNeed), oficio y ocio. El hardware de lentes llegará; la ética y las APIs empiezan hoy.

## Tesis

El usuario no abre una app. Habla, oye y —solo con faro encendido— muestra lo que mira. El agente recuerda resúmenes, no crudo. Lo irreversible no se ejecuta solo.

## Canales

| Canal | Hardware de hoy | Default | Faro | Crudo a la nube |
|---|---|---|---|---|
| Voz | Micrófono del teléfono | Off | Sí, mientras graba | No. Solo transcripción del turno |
| Oído | Audífonos / `speechSynthesis` | On | No | No |
| Ojo | Cámara (calle) | Off | Sí, mientras el preview vive | No. Solo el texto “lo que veo” |

Modo **terapia / empresa / ocio**: el ojo permanece apagado. Modo **calle**: ojo opt-in.

## Vetos (nunca autónomos)

`diagnosticar` · `presentar_contacto` · `mover_dinero` · `grabar` · `publicar` · `activar_ojo`

Un “sí” del usuario **registra intención**. El órgano piloto aún no dispara pagos, mensajes ni diagnósticos. Esa negativa es el producto.

## Triple Filtro Nexus

1. ¿Es verdad? (hecho vs absoluto)
2. ¿Es bondadoso? (no dañar)
3. ¿Es útil ahora? (paso posible o pedir ayuda)

Veredictos: `actuar` · `esperar` · `soltar` · `pedir_ayuda`

## Endpoints (CMS Netlify)

- `GET/POST /.netlify/functions/organo-piloto` — `accion`: `contrato` | `turno` | `memoria` | `veto`
- `POST /.netlify/functions/organo-transcribe` — audio efímero (Santuario o 3/día público)

El chat clásico (`chat`, `member-chat`) sigue vivo. La presencia nueva no lo rompe.

## Dónde se ve

- Público: `/nexus#organo-piloto` (plática continua de 10 min; música solo en el primer consejo del día)
- Santuario: `/miembro/` (plática continua de 30 min, memoria resumida 30 días; misma regla de música)
- ContacNeed: skill de **encuentro** — propone perfiles, no envía solicitudes

## Qué no hace (a propósito)

No sube fotogramas. No sustituye al terapeuta. No presenta personas. No cobra. No finge consciencia: es un contrato de percepción con criterio.
