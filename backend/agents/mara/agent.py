"""
agent.py — El cerebro de Mara, la agente de soporte técnico post-venta.

Mara no sabe nada de Haceb ni de VTEX: solo sabe que tiene tres herramientas
(mara/tools.py). Toda su conducta vive en el SYSTEM_PROMPT de abajo, y su
especificación completa está en mara/MARA.md.

Habla con cualquier proveedor que use el protocolo de OpenAI, cambiando solo el
base_url (se configura en el .env):
  • Groq   → nube, gratis, rápido, tool-calling confiable. El recomendado.
  • Ollama → local y offline, más lento. Respaldo si no hay internet.

El function-calling es MANUAL (nuestro propio bucle) a propósito: así podemos
imprimir en pantalla qué herramienta está usando, que es la prueba visible de
que está leyendo el manual de verdad y no improvisando.

Ejecutar:  ./venv/bin/python mara/agent.py
"""

import json
import os
import warnings

warnings.filterwarnings("ignore")

try:
    from dotenv import load_dotenv
    from openai import OpenAI
except ImportError:
    raise SystemExit(
        "Faltan dependencias. Con el venv activo:  pip install -r requirements.txt"
    )

try:
    from . import tools
except ImportError:  # Permite seguir ejecutando `python mara/agent.py`.
    import tools

# El .env vive en la raíz del repo, un nivel arriba de mara/
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(RAIZ, ".env"))

# Todos hablan el protocolo de OpenAI, así que basta cambiar el base_url.
# 'auto_respaldo' marca los que podemos usar solos si el primero se queda sin
# cuota. Ollama no lo lleva: solo sirve si el usuario lo eligió a propósito y
# tiene el servidor local prendido.
PROVEEDORES = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "key_env": "GROQ_API_KEY",
        "modelo": "llama-3.3-70b-versatile",
        "auto_respaldo": True,
    },
    "gemini": {
        # Google expone una capa compatible con OpenAI, así que el mismo SDK
        # y las mismas declaraciones de herramientas funcionan sin cambios.
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "key_env": "GEMINI_API_KEY",
        "modelo": "gemini-flash-latest",
        "auto_respaldo": True,
    },
    "openai": {
        # Reutiliza cualquier proveedor compatible configurado para Jota
        # (DeepSeek, OpenAI, Groq compatible, etc.) dentro del monolito.
        "base_url": os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        "key_env": "OPENAI_API_KEY",
        "modelo": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "auto_respaldo": True,
    },
    "ollama": {
        "base_url": "http://localhost:11434/v1",
        "key_env": None,            # Ollama no pide clave
        "modelo": "qwen2.5:7b",     # descargar con: ollama pull qwen2.5:7b
        "auto_respaldo": False,
    },
}

# Señales de que nos quedamos sin cuota y toca cambiar de proveedor. El tier
# gratis de Groq se agota por tokens al día, y el de Gemini por minuto: pasa a
# mitad de una demo, así que Mara tiene que sobrevivirlo sola.
SENALES_DE_CUOTA = ("rate limit", "rate_limit", "429", "quota", "resource_exhausted",
                    "insufficient_quota", "too many requests")

# Temperatura baja: Mara debe ceñirse al manual, no ser creativa.
TEMPERATURA = 0.3

# Tope de idas y vueltas con herramientas por turno, para que no se cicle.
MAX_RONDAS = 8


# ---------------------------------------------------------------------------
# Quién es Mara. Todo su comportamiento está acá.
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """
Eres Mara, técnica de soporte post-venta de Haceb (electrodomésticos
colombianos). Atiendes a clientes que YA compraron su producto y lo tienen en
casa: dudas de instalación, mantenimiento, uso, características o fallas.

═══ REGLA DE ORO (la más importante) ═══
NUNCA des un dato técnico que no venga de una herramienta. Ni un paso, ni un
voltaje, ni una temperatura, ni una frecuencia de limpieza. Si no lo leíste en
el manual o en la ficha del producto, NO lo digas.
Tu conocimiento general sobre electrodomésticos NO es una fuente válida: un
procedimiento inventado puede dañar el equipo o lastimar al cliente.
Cuando no tengas el dato, dilo y escala. Admitir el límite es hacer bien tu
trabajo, no fallar.

═══ ANTES DE TODO: ¿HAY RIESGO DE SEGURIDAD? ═══
Esta comprobación va PRIMERO, antes de identificar el modelo y antes de llamar
ninguna herramienta.
Si el cliente menciona olor a quemado, humo, chispas, fuego, fuga de gas, cable
pelado o una descarga eléctrica:
→ Responde DE INMEDIATO, en ese mismo turno, SIN llamar ninguna herramienta y
  SIN preguntar de qué modelo se trata. El modelo es irrelevante: la respuesta
  es la misma para todos.
→ Dile que apague y desconecte el equipo ya, que no lo vuelva a encender, y que
  contacte servicio técnico Haceb.
→ NO des pasos de revisión, diagnóstico ni reparación. Nada de "verifica si...".
Preguntar por el modelo mientras algo huele a quemado es hacerle perder tiempo
al cliente en el peor momento posible.

═══ CÓMO TRABAJAS (si no hay riesgo) ═══
1. IDENTIFICA EL MODELO con 'buscar_producto' antes de cualquier otra cosa.

   Búscalo con el NOMBRE DEL PRODUCTO, corto: "lavadora secadora", "nevera",
   "aire acondicionado 9000 btu". NO le pases la frase completa del cliente: la
   API busca sobre el nombre del producto, y palabras como "conector", "raro" o
   "pared" hacen que no encuentre nada. Quédate con el electrodoméstico y, si lo
   dijo, su capacidad.

   Si la búsqueda devuelve MÁS DE UN modelo, NO elijas por el cliente:
   muéstrale la lista numerada y pregúntale cuál es el suyo. Detente ahí y
   espera su respuesta. Cada modelo tiene su propio manual, y responder con el
   manual equivocado es tan grave como inventar.
   Si devuelve UN SOLO modelo y coincide con lo que describió, sigue con ese: no
   lo hagas confirmar lo obvio.
   Solo sigue cuando tengas un productId concreto.

   SI LA BÚSQUEDA VUELVE VACÍA:
   → Reintenta UNA vez con un término más corto y más genérico (de "lavadora
     secadora carga frontal 12kg" a "lavadora").
   → Si sigue vacía, pregúntale simplemente QUÉ ELECTRODOMÉSTICO es, o pídele el
     nombre o la referencia que aparece en la etiqueta del equipo.
   → NUNCA le hagas preguntas técnicas que él no puede responder para
     identificar el producto ("¿es de 3 o 4 hilos?", "¿tiene algún símbolo?").
     Él te consultó porque no sabe de esto; interrogarlo así lo deja peor que
     como llegó.
   → NUNCA digas "no puedo continuar con la búsqueda". No significa nada para el
     cliente. Di qué necesitas de él, en concreto y en una sola pregunta.
2. ELIGE BIEN LA HERRAMIENTA. Cada dato vive en un solo lugar:
   • 'obtener_informacion_producto' (la ficha técnica) → MEDIDAS (alto, ancho,
     profundo), peso, VOLTAJE, potencia en watts, frecuencia, capacidad en
     litros, garantía y consumo energético.
     Aquí van las preguntas de "¿me cabe en este espacio / cajón / nicho?" y de
     "¿mi instalación eléctrica lo soporta?". El manual casi nunca trae las
     medidas del producto: están en la ficha.
   • 'consultar_manual' → PROCEDIMIENTOS: cómo instalarlo, cómo limpiarlo, cada
     cuánto, cómo usar una función, qué hacer ante una falla, advertencias.
   Si la duda mezcla las dos cosas (el caso típico: "no sé si me cabe y no sé si
   lo aguanta mi toma"), usa AMBAS y responde las dos partes.
   Y si preguntan por medidas o voltaje, consulta la ficha ANTES de decir que no
   tienes el dato.

   ⚠️ CASO ESPECIAL — "¿me cabe en el cajón / nicho / mueble?":
   Las medidas NO alcanzan para contestar eso. Un electrodoméstico metido en un
   espacio cerrado a la medida exacta puede tapar sus rejillas de ventilación y
   recalentarse. Así que en estas preguntas consulta SIEMPRE también el manual
   (espacio libre, ventilación, instalación) y dile al cliente las dos cosas:
   las medidas del equipo Y qué espacio libre exige el manual alrededor.
   Si el manual advierte sobre no obstruir la ventilación, dilo explícitamente:
   es una advertencia de seguridad, no un detalle.

═══ CÓMO USAR LO QUE DEVUELVE 'consultar_manual' ═══
Tiene tres resultados posibles y se tratan DISTINTO:

• Trae 'fragmentos' con contenido → Responde con ellos y CITA la fuente:
  «Según el manual de tu [modelo]...». Reproduce los datos concretos que
  encontraste: pasos, frecuencias, valores, advertencias. Nada de consejos
  genéricos.
  Antes de responder, verifica que los fragmentos SÍ contesten lo que
  preguntaron. Si hablan de otro tema, trátalo como si no hubiera información:
  no estires un fragmento para que parezca una respuesta.

• 'fragmentos' viene vacío → El manual de ese modelo no cubre el tema. Dilo con
  claridad y escala al canal de servicio. NO rellenes con conocimiento propio.

• 'disponible' es false y viene 'manual_url' → El manual de ese modelo es
  interactivo y no lo puedes leer aquí. Dilo con honestidad, entrégale el
  ENLACE DIRECTO para que lo abra en su navegador, y ofrécele ayuda con
  garantía o especificaciones. NO inventes pasos de instalación ni conexión.

═══ CUÁNDO ESCALAR ═══
• RIESGO DE SEGURIDAD → ver la sección de arriba. Va antes que todo lo demás.
• GARANTÍA (se dañó, vino defectuoso) → consulta la garantía real con
  'obtener_informacion_producto', menciónale la cobertura que viste, y
  derívalo al canal de garantía.
• LA FALLA PERSISTE tras los pasos del manual → escala a servicio técnico.
• EL TEMA NO ESTÁ EN EL MANUAL → dilo y escala.
Antes de escalar, entrega lo que SÍ tengas: si el manual cubre parte del
problema, da esa parte y después deriva. Nunca escales con las manos vacías si
había algo útil.

═══ TU TONO ═══
Seria y pragmática. Estás atendiendo a alguien con un problema, a veces
frustrado o preocupado: lo que necesita es claridad y saber qué hacer, no
entusiasmo.
• Español, de tú. Frases cortas. Procedimientos en pasos numerados.
• Reconoce la molestia UNA vez, breve, y pasa a resolver.
• Sin efusividad: nada de «¡Claro que sí!», «¡con gusto!», «¡genial!» ni
  cadenas de signos de exclamación. Un emoji como máximo, y solo si de verdad
  aporta (⚠️ en una advertencia real de seguridad).
• No prometas lo que no puedes cumplir («ya te lo soluciono»).
• Directa, pero no cortante: la persona ya pagó por este producto.
• No te disculpes por cosas que no son tu culpa. En vez de «lo siento, pero la
  búsqueda arrojó varios modelos», di «encontré varios modelos, ¿cuál es el
  tuyo?».
• NUNCA le muestres al cliente los productId ni ningún código interno: no
  significan nada para él. Cuando listes modelos, numéralos 1, 2, 3 y usa el
  nombre del producto.
"""


# ---------------------------------------------------------------------------
# Declaración de las herramientas en el formato que espera el modelo
# ---------------------------------------------------------------------------
TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "buscar_producto",
            "description": (
                "Busca productos de Haceb por nombre o descripción para identificar "
                "el modelo que tiene el cliente. Úsala SIEMPRE primero."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "consulta": {
                        "type": "string",
                        "description": "Qué buscar, ej: 'aire acondicionado 9000 btu'.",
                    }
                },
                "required": ["consulta"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "obtener_informacion_producto",
            "description": (
                "Ficha técnica de un modelo ya identificado: MEDIDAS (alto, ancho, "
                "profundo), peso, VOLTAJE, potencia en watts, capacidad, garantía y "
                "consumo energético. Úsala para saber si el producto cabe en un "
                "espacio o si la instalación eléctrica lo soporta, y para garantía. "
                "Estos datos están acá, no en el manual."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {
                        "type": "string",
                        "description": "El productId del modelo confirmado.",
                    }
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_manual",
            "description": (
                "Lee el manual oficial del modelo y devuelve los fragmentos "
                "relevantes a la duda. Para instalación, mantenimiento, uso y fallas."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {
                        "type": "string",
                        "description": "El productId del modelo confirmado.",
                    },
                    "pregunta": {
                        "type": "string",
                        "description": "La duda del cliente, en sus propias palabras.",
                    },
                },
                "required": ["product_id", "pregunta"],
            },
        },
    },
]

DISPATCH = {
    "buscar_producto": tools.buscar_producto,
    "obtener_informacion_producto": tools.obtener_informacion_producto,
    "consultar_manual": tools.consultar_manual,
}

ICONOS = {
    "buscar_producto": "🔍 Buscando en el catálogo",
    "obtener_informacion_producto": "📋 Consultando ficha y garantía",
    "consultar_manual": "📖 Leyendo el manual",
}


def construir_cadena():
    """
    Arma la lista de proveedores usables: primero el del .env, y detrás los
    demás que tengan clave, como respaldo si el primero se queda sin cuota.
    """
    preferido = os.environ.get("PROVEEDOR", "groq").strip().lower()
    if preferido not in PROVEEDORES:
        raise SystemExit(f"PROVEEDOR '{preferido}' no existe. Opciones: {list(PROVEEDORES)}")

    orden = [preferido] + [n for n in PROVEEDORES
                           if n != preferido and PROVEEDORES[n]["auto_respaldo"]]

    cadena = []
    for nombre in orden:
        cfg = PROVEEDORES[nombre]
        clave = "ollama"  # Ollama no valida la clave, pero el SDK exige algo
        if cfg["key_env"]:
            clave = os.environ.get(cfg["key_env"], "").strip()
            if not clave:
                continue  # sin clave no se puede usar; no es un error
        cadena.append((OpenAI(base_url=cfg["base_url"], api_key=clave),
                       cfg["modelo"], nombre))

    if not cadena:
        raise SystemExit(
            f"No hay ningún proveedor usable. Pon al menos una clave en el .env "
            f"(copia .env.example)."
        )
    return cadena


def _es_falta_de_cuota(error) -> bool:
    """¿El error es de cuota agotada (y por tanto vale cambiar de proveedor)?"""
    mensaje = str(error).lower()
    return any(senal in mensaje for senal in SENALES_DE_CUOTA)


def _mostrar_herramienta(nombre, args):
    """
    Imprime qué está haciendo Mara.

    No es decoración: es lo que le demuestra al cliente (y al jurado) que de
    verdad está consultando el manual y no improvisando.
    """
    detalle = args.get("pregunta") or args.get("consulta") or args.get("product_id") or ""
    print(f"     · {ICONOS.get(nombre, nombre)}: {detalle}")


def responder(cadena, mensajes, max_rondas=MAX_RONDAS, on_tool_result=None):
    """
    Contesta el turno, cambiando de proveedor si el actual se queda sin cuota.

    El historial queda consistente para reintentar: cuando falla, ya devolvimos
    el resultado de todas las herramientas que se habían pedido.
    """
    ultimo = len(cadena) - 1
    for indice, (cliente, modelo, nombre) in enumerate(cadena):
        try:
            return _conversar(
                cliente,
                modelo,
                mensajes,
                max_rondas,
                on_tool_result=on_tool_result,
            )
        except Exception as error:
            if not _es_falta_de_cuota(error) or indice == ultimo:
                raise
            siguiente = cadena[indice + 1][2]
            print(f"     · ⚠️  {nombre} se quedó sin cuota; sigo con {siguiente}")


def _para_historial(mensaje) -> dict:
    """
    Convierte el mensaje del asistente en un dict para el historial,
    PRESERVANDO los campos extra que agregue el proveedor.

    Importa más de lo que parece: los modelos de Gemini con razonamiento
    devuelven un 'thought_signature' dentro de cada tool_call y exigen que se lo
    devolvamos tal cual en el siguiente turno. Si armamos el dict a mano campo
    por campo, esa firma se pierde y Gemini rechaza todo el historial con un
    HTTP 400. Volcar el objeto original nos deja agnósticos del proveedor.
    """
    volcado = mensaje.model_dump(exclude_none=True)
    return {
        "role": "assistant",
        "content": volcado.get("content") or "",
        "tool_calls": volcado.get("tool_calls", []),
    }


def _conversar(cliente, modelo, mensajes, max_rondas, on_tool_result=None):
    """
    Bucle de function-calling: le preguntamos al modelo; si pide herramientas,
    las ejecutamos y le devolvemos el resultado; repetimos hasta que conteste.
    """
    for _ in range(max_rondas):
        respuesta = cliente.chat.completions.create(
            model=modelo,
            messages=mensajes,
            tools=TOOL_SCHEMAS,
            tool_choice="auto",
            temperature=TEMPERATURA,
        )
        mensaje = respuesta.choices[0].message

        # Sin tool_calls = ya tiene la respuesta final.
        if not mensaje.tool_calls:
            mensajes.append({"role": "assistant", "content": mensaje.content})
            return mensaje.content

        # Guardamos en el historial que el modelo pidió herramientas...
        mensajes.append(_para_historial(mensaje))

        # ...y las ejecutamos, devolviéndole cada resultado.
        for tc in mensaje.tool_calls:
            nombre = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
                _mostrar_herramienta(nombre, args)
                resultado = DISPATCH[nombre](**args)
            except KeyError:
                resultado = {"error": f"la herramienta '{nombre}' no existe"}
            except Exception as e:
                resultado = {"error": str(e)}
            if on_tool_result:
                on_tool_result(nombre, args, resultado)
            mensajes.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(resultado, ensure_ascii=False),
            })

    return ("No pude completar la consulta. Te sugiero contactar la línea de "
            "servicio Haceb para que te atiendan directamente.")


class AgenteSoporte:
    """Fachada con estado de sesión para consumir Mara desde HTTP."""

    nombre = "Mara"
    empresa = "Haceb"

    def __init__(self):
        self.cadena = construir_cadena()
        self.mensajes = [{"role": "system", "content": SYSTEM_PROMPT}]
        self.ultimo_resultado_herramientas = []

    @property
    def historial(self):
        return self.mensajes[1:]

    def enviar_mensaje(self, mensaje_usuario: str) -> str:
        self.ultimo_resultado_herramientas = []
        self.mensajes.append({"role": "user", "content": mensaje_usuario})

        def registrar(nombre, argumentos, resultado):
            self.ultimo_resultado_herramientas.append({
                "name": nombre,
                "arguments": argumentos,
                "payload": resultado,
            })

        return responder(
            self.cadena,
            self.mensajes,
            on_tool_result=registrar,
        )

    def resetear(self):
        self.mensajes = [{"role": "system", "content": SYSTEM_PROMPT}]
        self.ultimo_resultado_herramientas = []


def main():
    cadena = construir_cadena()
    mensajes = [{"role": "system", "content": SYSTEM_PROMPT}]

    _, modelo, proveedor = cadena[0]
    respaldos = ", ".join(nombre for _, _, nombre in cadena[1:])

    print("\n" + "═" * 64)
    print(f"  🔧 MARA · Soporte técnico Haceb      [{proveedor} · {modelo}]")
    if respaldos:
        print(f"  respaldo si se agota la cuota: {respaldos}")
    print("═" * 64)
    print("  Cuéntame qué producto tienes y qué está pasando.")
    print("  Escribe 'salir' para terminar.\n")

    while True:
        try:
            entrada = input("  Tú: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n  Hasta luego.\n")
            break

        if not entrada:
            continue
        if entrada.lower() in ("salir", "exit", "quit"):
            print("\n  Hasta luego.\n")
            break

        mensajes.append({"role": "user", "content": entrada})
        try:
            texto = responder(cadena, mensajes)
            print(f"\n  Mara: {texto}\n")
        except Exception as e:
            print(f"\n  [!] Error del proveedor: {e}\n")


if __name__ == "__main__":
    main()
