# HACEB Asistente — prototipo conversacional

Prototipo web de una experiencia conversacional con dos recorridos:

- **Ventas:** descubrimiento, recomendación y comparación de electrodomésticos.
- **Soporte:** diagnóstico guiado, seguridad, garantía y solicitud de servicio.

“HACEB Asistente” es un nombre provisional y no debe interpretarse como una
denominación oficial. En modo mock la aplicación usa datos demostrativos; con
Jota habilitado, ventas consulta precios, inventario, imágenes y referencias
desde el catálogo VTEX de Haceb.

## Estado y alcance

El proyecto implementa:

- portada responsive con elección inmediata entre ventas y soporte;
- espacio conversacional de tres zonas en escritorio;
- historial, contexto y comparación adaptados como paneles en pantallas
  pequeñas;
- conversaciones separadas en memoria para cada agente;
- respuestas estructuradas mediante un contrato compartido (mock local o API
  real de Jota);
- bloques enriquecidos para productos, comparaciones, diagnósticos, alertas de
  seguridad, garantías, formularios, citas y transferencia a una persona;
- historial, catálogo y casos técnicos de demostración para soporte;
- descarga de un resumen en texto y uso de la API nativa de compartir cuando
  está disponible;
- validación local de adjuntos JPG, PNG, WEBP y PDF de hasta 10 MB.

La ruta de ventas puede consumirse desde el agente Jota en
`/home/camilosanchez/Documentos/hacksune_miku/hacksune-miku/Jota`. La conexión
real requiere configurar las credenciales del agente y del catálogo en su
backend; soporte, CRM, garantías, agenda y carga real de archivos siguen siendo
preparaciones o demostraciones.

## Rutas

| Ruta | Contenido |
| --- | --- |
| `/` | Portada y accesos rápidos |
| `/assistant/sales` | Agente de ventas |
| `/assistant/support` | Agente de soporte |
| `/assistant/sales?view=history` | Abre el historial en la interfaz del asistente |
| `/assistant/support?topic=help` | Muestra una orientación inicial |

Los accesos rápidos de la portada también agregan parámetros `?action=...`.
`ChatWorkspace` interpreta `compare`, `warranty`, `schedule`, `parts` y
`request-status`, limpia el parámetro de la URL y ejecuta la intención en el
agente correspondiente.

## Stack y versiones principales

Las versiones exactas siguientes corresponden al `package-lock.json` actual:

| Tecnología | Versión |
| --- | --- |
| Aplicación | 0.1.0 |
| Node.js | `>=22.12.0` |
| Astro | 7.1.3 |
| Integración React para Astro | 6.0.1 |
| React / React DOM | 19.2.8 |
| TypeScript | 6.0.3 |
| Tailwind CSS / plugin Vite | 4.3.3 |
| Lucide React | 1.26.0 |
| Manrope variable (`@fontsource`) | 5.3.0 |

Astro genera un sitio estático (`output: "static"`). React se reserva para las
zonas interactivas y no convierte toda la aplicación en una SPA. Tailwind está
integrado mediante Vite, aunque la identidad visual se construye principalmente
con CSS propio y variables de diseño.

## Requisitos e instalación

Se necesita Node.js 22.12 o posterior y npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Para conectar Jota en desarrollo, inicia primero su API (`uvicorn api:app
--reload --port 8000` desde la carpeta `Jota`) y cambia el `.env` del frontend:

```dotenv
PUBLIC_AGENT_API_URL=http://localhost:8000
PUBLIC_USE_MOCK_AGENTS=false
```

Jota expone `POST /api/chat` y mantiene `/chat` como alias compatible. El
request usa `agent`, `sessionId`, `message`, `productContext` y `attachments`;
la respuesta devuelve `id`, `sessionId`, `createdAt` y bloques `text` y
`product-list`. Los productos incluyen precio/disponibilidad del catálogo VTEX
de Haceb, imagen, referencia, categoría y URL de origen. Configura
`CORS_ORIGINS=http://localhost:4321` en `Jota/.env` si el frontend corre en el
puerto por defecto.

Con un `package-lock.json` ya verificado, `npm ci` es una alternativa
reproducible para integración continua.

Astro mostrará la URL local; por defecto suele ser
`http://localhost:4321`. Para exponer el servidor en la red local:

```bash
npm run dev -- --host
```

### Comandos

| Comando | Función |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run check` | Ejecuta el diagnóstico de Astro y TypeScript |
| `npm run build` | Ejecuta `astro check` y genera el sitio en `dist/` |
| `npm run preview` | Sirve localmente el último contenido de `dist/` |

No hay scripts de pruebas unitarias, pruebas end-to-end, lint o formato
configurados en este prototipo.

## Arquitectura

```text
Páginas y layouts Astro
        │
        ├── contenido estático y navegación
        │
        └── islas React
              │
              └── ChatWorkspace
                    │
                    └── AgentService
                          │
                          ├── MockChatTransport (activo)
                          └── HttpChatTransport (preparado)
                                  │
                                  └── POST /api/chat
```

### Renderizado e hidratación

- `BaseLayout.astro` define el documento, metadatos, idioma, enlace para saltar
  al contenido y `ClientRouter` de Astro.
- La portada usa Astro para la estructura. Las dos tarjetas de agente se
  hidratan con `client:visible`; la navegación móvil usa `client:load`.
- Las rutas de asistente hidratan `ChatWorkspace` con `client:load`, porque el
  chat, los formularios, los paneles y el streaming requieren estado continuo.
- `AssistantLayout.astro` marca las rutas conversacionales con
  `noindex, nofollow`.

### Estado

La fuente de verdad de la interfaz activa está hoy dentro de
`ChatWorkspace.tsx` mediante estado de React:

- mantiene un hilo independiente para `sales` y otro para `support`;
- conserva hilos, borradores, carga y controladores independientes mientras la
  isla siga montada;
- administra estado del agente, comparación, conectividad, modales, paneles y
  notificaciones;
- incorpora las conversaciones creadas durante la sesión al historial en
  memoria;
- cancela solo la respuesta del agente afectado mediante su propio
  `AbortController`.

El contenido creado durante la sesión no usa `localStorage`, IndexedDB ni un
backend. El historial combina fixtures y conversaciones nuevas en memoria, pero
se pierde al recargar la página.

`src/stores/` contiene stores tipados y compatibles con
`useSyncExternalStore`, pero la interfaz actual todavía no los consume. De igual
forma, `ProductsService` y `SupportService` ofrecen fronteras de repositorio
para una integración futura, mientras los componentes activos aún leen varios
fixtures directamente.

### Transporte conversacional

`AgentService` valida la solicitud y depende únicamente de la interfaz
`ChatTransport`. Esto permite cambiar el origen de respuestas sin modificar el
modelo de eventos ni los componentes visuales:

- `MockChatTransport`: activo por defecto; genera eventos progresivos y bloques
  a partir de palabras clave.
- `HttpChatTransport`: preparado para `POST /api/chat`; acepta SSE, NDJSON o
  JSON.
- un transporte propio puede implementar la misma interfaz con
  `kind: "custom"`.

### Responsive

- Más de `79.99rem`: barra lateral, conversación y contexto visibles.
- Hasta `79.99rem`: el contexto deja la grilla y se abre como drawer lateral.
- Hasta `52rem`: se muestra solo el chat; el historial abre lateralmente y el
  contexto como bottom sheet.
- Hasta `35rem`: se compactan mensajes, acciones rápidas, tarjetas y
  comparaciones.

## Estructura del proyecto

```text
.
├── public/
│   ├── favicon.svg                 # favicon provisional
│   └── images/
│       └── product-placeholder.svg # imagen de producto demostrativa
├── src/
│   ├── components/
│   │   ├── chat/                   # workspace, mensajes, composer y agente
│   │   ├── common/                 # botones, modal, sheet, toast y estados
│   │   ├── landing/                # hero, elección de agente y accesos
│   │   ├── layout/                 # header, sidebar, navegación y contexto
│   │   ├── sales/                  # tarjetas, carrusel y comparación
│   │   └── support/                # diagnóstico, garantía y agendamiento
│   ├── data/                       # fixtures y avisos de demostración
│   ├── layouts/                    # layouts Astro
│   ├── pages/                      # rutas de Astro
│   ├── services/                   # servicios y transportes mock/HTTP
│   ├── stores/                     # stores tipados aún no conectados a la UI
│   ├── styles/                     # tokens, estilos globales y del asistente
│   └── types/                      # contratos de agente, chat, producto y soporte
├── .env.example
├── astro.config.ts
├── package.json
└── tsconfig.json
```

## Decisiones de diseño

- **Un producto, dos especialidades.** Ambos agentes comparten navegación,
  composición y componentes, pero ventas usa un lenguaje más exploratorio y
  soporte prioriza seguridad y escalamiento.
- **React solo donde aporta estado.** La portada y los layouts permanecen en
  Astro; el chat y los controles complejos son islas.
- **Respuestas estructuradas.** El backend no tendría que enviar HTML. Devuelve
  bloques tipados y la UI decide cómo representar productos, formularios,
  diagnósticos o alertas.
- **Seguridad antes que continuidad.** Las menciones de gas, humo, chispas o
  recalentamiento detienen el diagnóstico simulado y ofrecen atención
  profesional.
- **Datos inciertos visibles.** Precios, inventario, referencias y cobertura no
  se presentan como oficiales. Los fixtures llevan metadatos y avisos de demo.
- **Diseño reemplazable.** Paleta, tipografía, radios, sombras, espacios y
  velocidades se concentran en tokens CSS.
- **Dependencias visuales ligeras.** Los iconos provienen de Lucide y la
  tipografía se sirve desde el paquete local de Manrope; no se usa una librería
  pesada de componentes.

## Datos y servicios de demostración

| Archivo | Contenido |
| --- | --- |
| `src/data/mock-agents.ts` | Nombres, estados y acciones rápidas de los dos agentes |
| `src/data/mock-products.ts` | 8 productos ficticios en 5 categorías y una comparación |
| `src/data/mock-support.ts` | 2 productos identificados, 3 diagnósticos, 2 garantías, 2 alertas, 2 solicitudes y 1 cita |
| `src/data/mock-conversations.ts` | 5 conversaciones ficticias agrupadas por fecha |
| `src/data/demo.ts` | Aviso común que identifica información no oficial |
| `src/services/mock-chat.transport.ts` | Selección de escenarios y streaming simulado |

Las referencias `REF-DEMO-*`, capacidades, dimensiones, valoraciones, nombres,
fechas, direcciones y estados son ficticios. La mayoría de precios e inventarios
se muestran como “por confirmar”; el agotado de una lavadora también es un
estado de demostración. Antes de publicar se deben reemplazar los repositorios
mock y validar todo dato con fuentes oficiales.

Los adjuntos seleccionados no se suben ni incluyen sus bytes en la solicitud.
La interfaz crea previsualizaciones locales para imágenes, simula el progreso y
construye metadato (`nombre`, tipo MIME, tamaño y estado). Una integración real
necesita un flujo de carga previo, URLs firmadas o un cambio explícito a
`multipart/form-data`.

## Cómo probar los estados demo

El mock normaliza mayúsculas y tildes. Envía estas frases desde el agente
indicado:

| Agente | Entrada o acción | Resultado |
| --- | --- | --- |
| Ventas | `Busco una nevera` | Carrusel de neveras |
| Ventas | `Quiero una lavadora` | Carrusel de lavadoras |
| Ventas | `Busco una estufa` | Producto de estufa |
| Ventas | `Necesito un calentador` | Producto de calentador |
| Ventas | `Busco aire acondicionado` | Opciones de aire acondicionado |
| Ventas | `Quiero comparar productos` | Comparación de dos neveras |
| Ventas | `No existe ese producto` o `sin resultados` | Estado vacío y acción para ajustar la búsqueda |
| Soporte | `Mi nevera no enfría` | Diagnóstico guiado de nevera |
| Soporte | `Mi lavadora no inicia` | Diagnóstico guiado de lavadora |
| Soporte | `Quiero consultar la garantía` | Tarjeta de garantía |
| Soporte | `Agendar una visita técnica` | Formulario guiado de seis pasos |
| Soporte | `Confirmar cita` | Confirmación de cita ya preparada |
| Soporte | una frase con `gas` | Alerta crítica de gas y escalamiento |
| Soporte | una frase con `humo`, `chispa` o `recalentamiento` | Alerta eléctrica y escalamiento |
| Cualquiera | `[demo:offline]` | Error de transporte sin conexión |
| Cualquiera | `[demo:agent-error]` | Error recuperable del agente |
| Cualquiera | `[demo:session-expired]` | Mensaje de sesión vencida |

Otros estados útiles:

- “Nueva conversación” o “Limpiar conversación” vuelve al estado inicial del
  agente activo sin alterar el otro hilo.
- Cada respuesta mock pasa por inicio, indicador de actividad, texto progresivo
  y finalización. Los retrasos por defecto son 180 ms al inicio, 24 ms por
  fragmento y 18 caracteres por fragmento.
- El comparador admite de dos a tres productos.
- Un archivo de tipo no permitido o de más de 10 MB muestra el estado de
  adjunto inválido. El composer limita la selección visible a cuatro archivos.
- Desactivar la red desde el navegador activa el estado offline y deshabilita
  el composer. Esto no equivale a persistencia durable.

## Cambiar del mock a `POST /api/chat`

### Activación por entorno

`src/services/agent.service.ts` ya selecciona el transporte a partir de
`.env`. No hace falta cambiar `ChatWorkspace` ni los componentes de mensajes.

Este repositorio no implementa `/api/chat`: la compilación es estática. El
despliegue debe proporcionar ese endpoint mediante un backend, una función o un
proxy del mismo origen. Si vive en otro origen, también debe configurarse CORS.

Con esa convención, `PUBLIC_AGENT_API_URL` representa el origen o URL base, sin
`/api/chat`:

```dotenv
PUBLIC_USE_MOCK_AGENTS=false
PUBLIC_AGENT_API_URL=https://backend.ejemplo.com
```

Para un proxy del mismo origen, dejar `PUBLIC_AGENT_API_URL` vacío produce
`/api/chat`. En una compilación estática las variables públicas se resuelven al
compilar; hay que reiniciar el servidor de desarrollo o reconstruir `dist/`
después de cambiarlas.

### Solicitud

`HttpChatTransport` envía:

```http
POST /api/chat
Content-Type: application/json
Accept: text/event-stream, application/x-ndjson, application/json
```

Ejemplo de cuerpo:

```json
{
  "agent": "sales",
  "sessionId": "session-123",
  "message": "Busco una nevera para cuatro personas",
  "productContext": {
    "category": "refrigerator"
  },
  "attachments": [
    {
      "id": "attachment-123",
      "name": "placa-producto.jpg",
      "mediaType": "image/jpeg",
      "sizeBytes": 245312,
      "uploadStatus": "ready"
    }
  ]
}
```

`agent` solo admite `sales` o `support`. `sessionId` y `message` no pueden estar
vacíos. `attachments` siempre debe ser un arreglo.

### Streaming

Para la interfaz actual se recomienda SSE
(`Content-Type: text/event-stream`) o NDJSON
(`Content-Type: application/x-ndjson`). Cada evento debe ocupar una línea JSON;
en SSE se antepone `data:` y se termina con una línea en blanco:

```text
data: {"type":"start","responseId":"response-123","agent":"sales","status":"consulting"}

data: {"type":"text-delta","responseId":"response-123","delta":"Encontré dos opciones "}

data: {"type":"block","responseId":"response-123","block":{"id":"products-123","type":"product-list","title":"Opciones","products":[]}}

data: {"type":"done","response":{"id":"response-123","agent":"sales","sessionId":"session-123","blocks":[{"id":"text-123","type":"text","text":"Encontré dos opciones"}],"createdAt":"2026-07-25T15:00:00.000Z"}}
```

Secuencia esperada:

1. `start` crea el mensaje pendiente. `status` admite `thinking` o
   `consulting`.
2. Cero o más `text-delta` construyen el texto visible.
3. Cero o más `block` agregan contenido enriquecido.
4. `done` entrega la respuesta completa y marca el mensaje como enviado.

Los bloques admitidos son:

```text
text | product-list | product-comparison | diagnostic | safety-alert
| warranty | form | appointment | human-handoff
```

También existe el evento de error:

```json
{
  "type": "error",
  "responseId": "response-123",
  "code": "agent-error",
  "message": "No pudimos completar la consulta.",
  "retryable": true
}
```

Los códigos reconocidos son `offline`, `agent-error`, `session-expired` e
`invalid-request`. El transporte convierte respuestas HTTP 401 y 403 en
`session-expired`; 429 y errores 5xx se consideran reintentables. Un fallo de
red se presenta como `offline`.

Aunque el transporte puede leer una respuesta `application/json`, el consumidor
visual actual está optimizado para recibir primero `start`. Una única
`AgentResponse` JSON funciona con `AgentService.send()`, pero `ChatWorkspace`
necesitaría crear el mensaje si recibe directamente `done`. Para integrar el
chat sin cambios, usar la secuencia completa de streaming.

En producción conviene comprobar que el proxy no almacene el stream en búfer,
que los eventos se vacíen progresivamente y que siempre llegue `done`. El
marcador textual `[DONE]` se ignora y no reemplaza el evento tipado `done`.

## Variables de entorno

| Variable | Ejemplo | Estado actual |
| --- | --- | --- |
| `PUBLIC_AGENT_API_URL` | `https://backend.ejemplo.com` | Declarada en `.env.example`, aún no consumida |
| `PUBLIC_USE_MOCK_AGENTS` | `true` o `false` | Declarada en `.env.example`, aún no consumida |

El prefijo `PUBLIC_` hace que el valor pueda incorporarse al JavaScript del
navegador. Nunca se deben guardar allí tokens privados, claves de API ni
credenciales. Para autenticación, preferir una sesión segura del mismo origen o
un intercambio gestionado por el backend.

## Cambiar colores, tipografía y logo

### Colores y sistema de diseño

La fuente principal de tokens es `src/styles/tokens.css`. Allí se pueden cambiar:

- `--brand-*`: marca, superficies, texto, bordes y estados;
- `--font-*` y `--text-*`: familias y escala tipográfica;
- `--space-*`: espaciado;
- `--radius-*`: radios;
- `--shadow-*`: elevación;
- `--duration-*` y `--ease-*`: movimiento.

Al cambiar el verde de marca también hay que buscar usos translúcidos escritos
como RGB o valores de respaldo:

```bash
rg -n "201 214 0|#c9d600|#b7c300" src public
```

Después de una sustitución de marca se deben volver a revisar contraste, foco,
estados de peligro/éxito y legibilidad; modificar solo el token principal no
garantiza esa validación.

La familia actual es Manrope variable, importada localmente en
`src/styles/global.css`. Para cambiarla, instalar o alojar la nueva fuente,
actualizar el `@import` y ajustar `--font-sans`.

### Logo

El encabezado de la portada busca, en este orden, un archivo dentro de
`public/`:

```text
logo-haceb.svg
logo-haceb.png
haceb-logo.svg
haceb-logo.png
haceb-logo.webp
logo.svg
logo.png
logo.webp
logo
```

Si no encuentra ninguno, muestra el texto “HACEB”. La detección ocurre durante
la compilación, por lo que hay que reconstruir el sitio después de añadir el
archivo.

La barra lateral del asistente usa actualmente un wordmark textual definido en
`AppSidebar.tsx`; no hereda automáticamente la imagen del encabezado. Para una
integración oficial debe actualizarse también ese componente, conservando un
texto alternativo adecuado. El favicon provisional vive en
`public/favicon.svg` y debe reemplazarse por separado.

No se debe redibujar, deformar ni animar un logo oficial. Mantener proporción,
área de seguridad y variantes aprobadas por marca.

## Accesibilidad

La implementación incluye:

- documento en español y estructura de encabezados/landmarks;
- enlace “Ir al contenido principal”;
- foco visible global y etiquetas accesibles para botones de icono;
- controles con `aria-pressed`, `aria-current`, `aria-expanded` y
  `aria-invalid` donde corresponde;
- región `aria-live` para la conversación y roles de estado/alerta;
- tablas semánticas para comparación y `progressbar` para diagnóstico;
- modal con foco inicial, ciclo de tabulación, cierre con `Escape` y devolución
  del foco;
- navegación móvil con contención de foco;
- reducción global de animaciones con `prefers-reduced-motion`;
- formularios con etiquetas y mensajes de error asociados en varios campos.

Estas medidas no equivalen a una auditoría WCAG. Antes de producción se debe
verificar al menos:

- navegación completa solo con teclado y orden de foco en menús y `Sheet`;
- lectores de pantalla en los navegadores objetivo;
- contraste después de aplicar colores oficiales;
- zoom de 200 % y 400 %, reflow y tamaños táctiles;
- comportamiento del auto-scroll con movimiento reducido;
- anuncios del contenido que llega por streaming;
- errores del formulario y adjuntos;
- Axe, Lighthouse y pruebas manuales con tecnologías de asistencia.

## Límites antes de producción

- Reemplazar todos los fixtures por fuentes oficiales y mantener una indicación
  clara de procedencia/fecha.
- Conectar autenticación, sesiones, persistencia e historial real.
- Implementar carga segura de archivos, antivirus, límites del servidor y
  tratamiento de datos personales.
- Conectar catálogo, inventario, precios, garantías, solicitudes y agenda.
- Confirmar cualquier recomendación de seguridad con especialistas y canales
  oficiales.
- Sincronizar el panel contextual con el contenido real de cada conversación;
  hoy contiene partes fijas de demostración.
- Conectar o retirar los stores y servicios preparatorios que la UI aún no usa.
- Hacer que los parámetros `?action=` ejecuten la intención correspondiente.
- Añadir pruebas automatizadas, manejo de observabilidad, analítica consentida y
  políticas de reintento.
- Revisar copias que sugieren guardado local: el estado actual vive únicamente
  en memoria y no sobrevive una recarga.

## Verificación de esta entrega

Se ejecutó `npm run check` con Node.js 22.22.0 y npm 10.9.4: Astro reportó 0
errores, 0 advertencias y 0 sugerencias en 62 archivos. Esta verificación cubre
diagnóstico estático; no sustituye pruebas visuales, funcionales, de navegador
ni de accesibilidad.
