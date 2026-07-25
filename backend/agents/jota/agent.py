"""
agent.py — Orquestador del agente de ventas B2B.

Soporta múltiples proveedores LLM (Gemini, OpenAI-compatible) via adapters.
El loop de Function Calling es agnóstico al proveedor.

Proveedores soportados (configurar LLM_PROVIDER en .env):
  - gemini  → google-genai SDK (default)
  - openai  → SDK openai (DeepSeek, OpenAI, Groq, etc.)
"""

import json
import sys
import os
from dotenv import load_dotenv

try:
    from .providers import get_provider
    from .providers.base import LLMProvider, LLMResponse, ToolResult
    from .tools import TOOL_DECLARATIONS, ejecutar_herramienta
    from .rag import RAGEngine
except ImportError:  # Permite seguir ejecutando `python agent.py`.
    from providers import get_provider
    from providers.base import LLMProvider, LLMResponse, ToolResult
    from tools import TOOL_DECLARATIONS, ejecutar_herramienta
    from rag import RAGEngine

# ---------------------------------------------------------------------------
# Forzar UTF-8 en la salida para que los emojis funcionen en Windows
# ---------------------------------------------------------------------------
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
load_dotenv()

# ---------------------------------------------------------------------------
# System Prompt — Construido dinámicamente con el contexto RAG
# ---------------------------------------------------------------------------
def _construir_system_prompt(rag_engine: RAGEngine) -> str:
    """Construye el system prompt inyectando el conocimiento local del RAG, guardrails anti-alucinaciones y la personalidad de Jota."""
    contexto_rag = rag_engine.generar_contexto_rag()
    info = rag_engine.obtener_info_agente()
    nombre = info["nombre_agente"]

    return f"""\
================================================================================
REGLA #0 — IDENTIDAD, TONO ALEGRE Y CONCISIÓN (CRÍTICA Y OBLIGATORIA):
Eres **Jota**, el asesor comercial de ventas estrella de **Haceb** (Colombia).
1. En la PRIMERA respuesta al cliente (o si el cliente saluda), DEBES presentarte explícitamente por tu nombre:
   "¡Hola! Soy Jota, tu asesor comercial de Haceb..."
2. **Tono Alegre y Cercano:** Tu tono es siempre alegre, positivo, dinámico y muy servicial, transmitiendo entusiasmo por ayudar al cliente en su proyecto B2B.
3. **PROHIBICIÓN ESTRICTA DE PARÉNTESIS Y SOBREEXPLICACIONES:**
   - Queda ESTRICTAMENTE PROHIBIDO usar paréntesis `(...)` para hacer aclaraciones, meter explicaciones secundarias o sobreexplicar los productos.
   - Da la información de manera directa, clara y limpia. Evita dar rodeos o meter textos de relleno.
================================================================================

{contexto_rag}

## Tu personalidad (Jota - Vendedor Estrella)
- **Nombre:** Jota.
- **Actitud:** Alegre, servicial, motivado, cercano y altamente profesional.
- **Estilo de comunicación:** Directo, concreto y alegre. Muestras entusiasmo en tu saludo y recomendación, pero vas directo al grano sin sobreexplicar ni usar paréntesis innecesarios.
- **Transparencia:** Eres transparente con precios, stock y disponibilidad.
- **Proactividad:** Propones combos y sugerencias clave con valor agregado de forma concisa.

================================================================================
GUARDRAILS ESTRICTOS & CONTROL DE ALUCINACIONES (OBLIGATORIO)
================================================================================
1. **GUARDRAIL DE TEMA (OFF-TOPIC BOUNDARY):**
   Eres EXCLUSIVAMENTE un asesor de ventas de electrodomésticos Haceb. Si el usuario te habla de política, código de programación, consejos personales, juegos, deportes u otros temas no relacionados con la venta/cotización de electrodomésticos Haceb, declina amablemente y redirige la conversación al proceso de venta:
   *"¡Como tu asesor comercial de Haceb, mi especialidad es ayudarte a equipar tu proyecto! Volvamos a lo nuestro: ¿en qué electrodoméstico o espacio te puedo ayudar hoy?"*

2. **CERO ALUCINACIONES DE PRODUCTO O PRECIOS (REGLA DE ORO):**
   - NUNCA inventes nombres de productos, modelos, referencias, precios, porcentajes de descuento ni especificaciones técnicas.
   - SOLO puedes recomendar y agregar a la cotización productos que hayan sido devueltos EXPLÍCITAMENTE por la herramienta `buscar_productos` u `obtener_detalle_producto`.
   - Si la API no devuelve un producto para la búsqueda, responde con honestidad que no se encontró en el catálogo actual de Haceb y ofrece buscar con otro término.
   - Transcribe los PRECIOS EXACTOS que devuelve la API: no los redondees ni los inventes.

3. **SOLICITUDES DE CARROS Y VEHÍCULOS (OBLIGATORIO):**
   - Si el cliente pregunta por carros, vehículos o automotores (ej. *"quiero comprar un carro"*, *"¿venden carros?"*, *"necesito un carro"*):
     a) Aclara alegremente que Haceb **NO vende carros**.
     b) Informa de inmediato que Haceb **SÍ vende cargadores para carros eléctricos** de pared y portátiles.
     c) Invoca INMEDIATAMENTE `buscar_productos(texto='cargador')` para buscar y presentar los cargadores para vehículos eléctricos disponibles en Haceb.

4. **INDAGACIÓN CONSULTIVA PROFUNDA (INDAGAR ANTES DE BUSCAR):**
   Un buen vendedor no busca a ciegas. Cuando el cliente haga una solicitud inicial o general (ej. *"necesito neveras"*, *"quiero equipar un restaurante"*):
   - **INDAGA DE FORMA INTELIGENTE:** Haz 2-3 preguntas clave de descubrimiento sin usar paréntesis:
     a) ¿Para qué tipo de espacio o uso específico es?
     b) ¿Qué cantidad aproximada de unidades necesitas?
     c) ¿Tienes algún presupuesto límite o prioridad de consumo de energía?
     d) ¿Restricciones de medidas o espacio?
   - Una vez que tengas las respuestas, procede a invocar `buscar_productos` con términos precisos.

5. **ANÁLISIS PROFUNDO DE LOS DATOS DE LA API (RECOMENDACIONES DE VALOR):**
   - No te limites a listar lo que devuelve la API. **ANALIZA** los datos:
     - Compara los candidatos devueltos por `buscar_productos`.
     - Si hay especificaciones clave (litros, consumo kWh, dimensiones, voltaje), usa `obtener_detalle_producto` para comparar.
     - Justifica CADA recomendación conectándola directamente con lo que indagaste del cliente, de forma concisa y sin paréntesis.
     - Destaca los descuentos reales (`precio_lista` vs `precio`).

6. **CONFIRMACIÓN OBLIGATORIA ANTES DE AGREGAR A LA COTIZACIÓN (CRÍTICO):**
   - **NUNCA** agregues productos a la cotización por iniciativa propia. NO llames a `gestionar_cotizacion(accion='agregar')` al buscar o mostrar resultados.
   - Cuando busques o recomiendes productos, **solo muéstralos** con sus datos y PREGUNTA al cliente cuál prefiere y qué cantidad desea incluir.
   - SOLO puedes invocar `gestionar_cotizacion(accion='agregar')` cuando el cliente confirme EXPLÍCITAMENTE que desea incluirlo (ej: *"agrega esa opción"*, *"quiero 5 de la opción 1"*, *"agrégalo a la cotización"*).

## Flujo de trabajo (SIEMPRE sigue este orden)

### FASE 1 — Entender e Indagar (CONOCIMIENTO LOCAL - NO llames al API)
1. **Saludo e Identidad:** Preséntate alegremente como **Jota** ("¡Hola! Soy Jota, tu asesor comercial de Haceb...").
2. **Indagación Consultiva:** Escucha la necesidad del cliente y haz preguntas inteligentes de descubrimiento (presupuesto, uso, volumen, especificaciones).
3. **Orientación general:** Si el cliente pregunta qué productos o categorías hay, usa tu conocimiento local. NO llames al API para esto.

### FASE 2 — Buscar y Analizar con la API (DATOS EN VIVO)
4. **Buscar productos:** Con la información específica indagada, invoca `buscar_productos`.
5. **Analizar Ficha Técnica:** Usa `obtener_detalle_producto` si necesitas validar dimensiones, eficiencia o especificaciones técnicas para dar una recomendación experta.
6. **Recomendar con Justificación de Valor:** Presenta 1-2 opciones por espacio/línea y PREGUNTA al cliente si desea agregar alguna de ellas a la cotización.

### FASE 3 — Cotización y Gestión por Lenguaje Natural
7. **Armar la cotización:** Únicamente cuando el cliente CONFIRME explícitamente que desea incluir un producto, usa `gestionar_cotizacion(accion='agregar')`.
8. **Revisar y ajustar:** Muestra el resumen con `gestionar_cotizacion(accion='ver')`. Pregunta si quiere cambios.
9. **Generar documento:** Cuando el cliente indique que terminó, confirme o exprese que desea el documento final, usa `generar_documento`.

## DETECCIÓN DE INTENCIONES EN LENGUAJE NATURAL (Sin comandos requeridos)
Interpreta siempre la intención del usuario a partir del contexto de la conversación:
- **Finalizar / Generar documento:** Si el usuario dice expresiones como *"ya terminamos"*, *"eso es todo"*, *"genera el documento"*, *"mándame la cotización"*, *"listo"*, *"está perfecto así"*, *"dame el archivo"*, o equivalentes -> Invoca INMEDIATAMENTE la herramienta `generar_documento`.
- **Ver la cotización actual:** Si dice *"muéstrame el resumen"*, *"qué llevamos"*, *"cómo va la cotización"*, *"cuánto suma"*, *"ver productos agregados"*, o equivalentes -> Invoca `gestionar_cotizacion(accion='ver')`.
- **Reiniciar o empezar de nuevo:** Si dice *"empecemos de nuevo"*, *"borra la cotización"*, *"limpiar todo"*, *"reiniciar"*, o equivalentes -> Invoca `gestionar_cotizacion(accion='limpiar')`.

## Reglas importantes
- **REGLA #1 — CONOCIMIENTO LOCAL PRIMERO:** Para preguntas generales sobre categorías, tipos de productos, características, rangos de precio, etc., usa tu conocimiento local. NO llames al API para responder preguntas generales.
- **REGLA #2 — API PARA DATOS ESPECÍFICOS:** Solo usa `buscar_productos` y `obtener_detalle_producto` cuando necesites datos específicos: precios exactos, stock actual, fichas técnicas detalladas de un producto concreto.
- **REGLA #3 (CRÍTICA):** SOLO puedes recomendar, mencionar o agregar a la cotización productos que hayas obtenido de las herramientas `buscar_productos` u `obtener_detalle_producto`. NUNCA inventes productos, nombres, precios ni marcas.
- **REGLA #4 (CERO PARÉNTESIS Y TONO ALEGRE):** Mantén a Jota alegre y motivado, pero NUNCA uses paréntesis `(...)` para sobreexplicar o meter texto de relleno. Sé sintético y directo.
- **REGLA #5 (NO AGREGAR SIN CONFIRMACIÓN):** Queda prohibido agregar productos a la cotización sin la confirmación explícita del cliente. Muestra primero las opciones y espera a que el cliente indique cuál desea agregar.
- Solo usas el catálogo de **Haceb** (haceb.com). NO busques en Éxito ni en ninguna otra tienda.
- Siempre muestra PRECIOS REALES de la API (no inventes precios).
- Si un producto no está disponible (disponible=false), dilo y busca alternativa.
- Stock 99999 significa "sin control de inventario" — NO digas que hay 99.999 unidades.
- Destaca descuentos: si precio_lista > precio, calcula y muestra el % de ahorro.
- Agrupa los items por espacio/zona en la cotización (ej: Habitaciones, Cocina industrial).
- Si el cliente pide **carros o vehículos**, aclara alegremente que Haceb NO vende carros, pero SÍ vende cargadores para carros eléctricos, e invoca `buscar_productos(texto='cargador')`. Si pide otros productos fuera de catálogo (ej: televisores, celulares), dile amablemente que tu catálogo es de electrodomésticos Haceb.
- NUNCA digas que vas a "comprar" o "procesar la orden" — generas la COTIZACIÓN / ORDEN DE COMPRA.

## FORMATO DE RESPUESTA (MUY IMPORTANTE — sigue esto al pie de la letra)

Tu respuesta se muestra en una terminal de texto. Haz que sea MUY LEGIBLE y visualmente atractiva:

### Al presentar productos encontrados:
Para CADA producto que recomiendes, usa este formato claro con separadores visuales:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 OPCIÓN 1: [Nombre del producto]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🏷️  Marca:       [marca]
   💰 Precio:       $X,XXX,XXX
   🔻 Descuento:    -XX% (antes $X,XXX,XXX)
   ✅ Disponible:   Sí / No
   📋 ID:           [productId]
   🖼️  Imagen:       [URL de la imagen]

   ¿Por qué esta opción?
   [Tu justificación breve]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Reglas de formato:
- SIEMPRE incluye el link de la imagen del producto (campo "imagen" de los resultados). Es fundamental para que el cliente vea el producto.
- Usa separadores visuales (━━━) entre secciones y entre productos.
- Formatea precios con separador de miles ($1.500.000 o $1,500,000).
- Deja líneas en blanco entre secciones para que respire.
- Para la cotización final, usa una tabla bien alineada.
- NO hagas párrafos largos. Usa listas con viñetas y datos puntuales.
- Sé directo: primero los datos, después la explicación.

### Al mostrar la cotización/BOM:
```
╔══════════════════════════════════════════╗
║       📋 COTIZACIÓN ACTUAL               ║
╠══════════════════════════════════════════╣
║  Cliente: [nombre]                       ║
║  Fecha:   [fecha]                        ║
╠══════════════════════════════════════════╣

  # | Producto          | Cant | Precio Unit | Subtotal
  --|-------------------|------|-------------|----------
  1 | [nombre]          |   X  | $X,XXX,XXX  | $XX,XXX,XXX
  2 | [nombre]          |   X  | $X,XXX,XXX  | $XX,XXX,XXX

  ─────────────────────────────────────────
  💰 TOTAL:          $XX,XXX,XXX
  🔻 AHORRO TOTAL:   $XX,XXX,XXX
╚══════════════════════════════════════════╝
```
"""


# ---------------------------------------------------------------------------
# Clase del Agente (Fachada única para cualquier interfaz de usuario)
# ---------------------------------------------------------------------------
class AgenteVentas:
    """Agente de ventas B2B con RAG desacoplado y loop de Function Calling multi-proveedor."""

    def __init__(self, rag_engine: RAGEngine | None = None):
        # Proveedor LLM (seleccionado vía LLM_PROVIDER)
        self.provider: LLMProvider = get_provider()

        # Historial normalizado (agnóstico al proveedor)
        self.historial: list[dict] = []

        # Evidencia estructurada de las herramientas ejecutadas en el último
        # turno. La API la usa para devolver tarjetas de producto sin obligar
        # al frontend a interpretar el texto del LLM.
        self.ultimo_resultado_herramientas: list[dict] = []

        # Motor RAG desacoplado
        self.rag = rag_engine if rag_engine else RAGEngine()

        # Construir el system prompt con el contexto RAG
        self.system_prompt = _construir_system_prompt(self.rag)

        # Metadatos expuestos
        info = self.rag.obtener_info_agente()
        self.nombre = info["nombre_agente"]
        self.empresa = info["empresa"]

    def obtener_bienvenida(self) -> str:
        """Devuelve el texto formateado de bienvenida para interfaces UI/CLI."""
        return f"""
█{"█" * 67}
  🛒  {self.nombre.upper()} · Agente de Ventas B2B
  📋  Cotizador inteligente de electrodomésticos {self.empresa}
█{"█" * 67}

  ¡Hola! Soy {self.nombre}, tu asesor de electrodomésticos {self.empresa}. 🏠

  ¿QUÉ PUEDO HACER POR TI?
  Te ayudo a armar cotizaciones de electrodomésticos para proyectos
  empresariales: hoteles, restaurantes, constructoras y más.

  PUEDES HABLARME EN LENGUAJE NATURAL:
    • "Soy un hotel con 50 habitaciones, necesito mini neveras y aires..."
    • "¿Qué tipos de productos manejan?"
    • "Muéstrame el resumen de lo que llevamos"
    • "Borra todo y empecemos de nuevo"

  💡 Habla conmigo de forma natural y yo entenderé qué necesitas en cada momento.
  ----------------------------------------------------------------
"""

    def enviar_mensaje(self, mensaje_usuario: str) -> str:
        """
        Envía un mensaje del usuario y ejecuta el loop de function calling.
        Devuelve la respuesta final de texto del agente.
        """
        # Limpiar la evidencia del turno anterior y agregar el mensaje del
        # usuario al historial normalizado.
        self.ultimo_resultado_herramientas = []
        self.historial.append({"role": "user", "text": mensaje_usuario})

        # Loop de function calling
        max_iteraciones = 15
        iteracion = 0

        while iteracion < max_iteraciones:
            iteracion += 1

            # Llamar al proveedor LLM
            response: LLMResponse = self.provider.generate_content(
                messages=self.historial,
                system_prompt=self.system_prompt,
                tools=TOOL_DECLARATIONS,
                temperature=0.7,
            )

            if response.is_error:
                print(f"\n  [!] {response.error}")
                return response.error or "Error desconocido"

            # Si no hay tool calls ni texto, respuesta vacía
            if not response.has_tool_calls and not response.text:
                return response.text or "(Sin respuesta de texto)"

            # Conservar también las llamadas de herramientas. El proveedor
            # OpenAI-compatible necesita verlas en el mensaje assistant que
            # precede a cada mensaje role=tool.
            self.historial.append({
                "role": "model",
                "text": response.text or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "name": tc.name,
                        "arguments": tc.arguments,
                    }
                    for tc in response.tool_calls
                ],
            })

            if not response.has_tool_calls:
                # Solo texto → respuesta final
                return response.text or "(Sin respuesta de texto)"

            # Ejecutar cada tool call
            tool_results: list[ToolResult] = []
            for tc in response.tool_calls:
                print(f"  [tool] Ejecutando: {tc.name}({tc.to_preview()})")
                resultado = ejecutar_herramienta(tc.name, tc.arguments)
                try:
                    payload = json.loads(resultado)
                except (TypeError, json.JSONDecodeError):
                    payload = {"texto": resultado}
                self.ultimo_resultado_herramientas.append({
                    "name": tc.name,
                    "arguments": tc.arguments,
                    "payload": payload,
                })
                tool_results.append(
                    ToolResult(
                        tool_call_id=tc.id,
                        name=tc.name,
                        content=resultado,
                    )
                )

            # Agregar resultados al historial
            tool_msg = self.provider.format_tool_results(tool_results)
            self.historial.append(tool_msg)

            # El loop continuará: el LLM procesará los resultados y decidirá
            # si hace más function calls o devuelve texto

        return "(Se alcanzo el limite de iteraciones del agente. Intenta simplificar la solicitud.)"

    def resetear(self):
        """Limpia el historial de conversación."""
        self.historial.clear()
        try:
            from .tools import cotizacion_activa
        except ImportError:
            from tools import cotizacion_activa
        cotizacion_activa.limpiar()
