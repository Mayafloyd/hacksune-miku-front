"""
docs_reader.py — Lector de manuales oficiales de Haceb.

Es la segunda fuente de datos de Mara (la otra es la API de catálogo). Descarga
el manual de un modelo, extrae su texto y recupera los fragmentos relevantes a
la duda del cliente. Eso es el RAG que hace que Mara pueda citar en vez de
inventar.

Los dos formatos que publica Haceb (ver mara/MARA.md §8):
  • PDF  → se extrae con 'pdftotext'. Funciona muy bien (~16.000 palabras).
  • HTML interactivo (neveras) → el contenido lo pinta JavaScript, así que solo
    se extraen ~29 palabras inútiles. Se DETECTA y se devuelve None con motivo,
    para que Mara entregue el enlace en vez de adivinar.

Verificar a mano:  ./venv/bin/python mara/docs_reader.py
"""

import hashlib
import html
import os
import re
import subprocess
import unicodedata
import warnings

warnings.filterwarnings("ignore")
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
TIMEOUT = 40

# Caché en disco: un PDF de manual pesa y tarda. Sin esto la demo se arrastra.
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache_manuales")

# Un HTML con menos palabras que esto es un visor interactivo, no un manual.
# Los visores de Haceb dan ~29 palabras; un manual real da miles.
MIN_PALABRAS_HTML = 60

# Umbral mínimo para considerar que se extrajo algo aprovechable.
MIN_PALABRAS_UTILES = 20


# ---------------------------------------------------------------------------
# Descarga y extracción de texto
# ---------------------------------------------------------------------------

def _ruta_cache(url: str) -> str:
    nombre = hashlib.md5(url.encode()).hexdigest()[:16]
    return os.path.join(CACHE_DIR, f"{nombre}.txt")


def _pdf_a_texto(datos: bytes) -> str:
    """Extrae texto de un PDF con pdftotext (entra por stdin, sale por stdout)."""
    try:
        res = subprocess.run(["pdftotext", "-", "-"], input=datos,
                             capture_output=True, timeout=TIMEOUT)
        return res.stdout.decode("utf-8", "ignore")
    except FileNotFoundError:
        return ""  # falta poppler-utils
    except subprocess.SubprocessError:
        return ""


def _html_a_texto(datos: bytes) -> str:
    """Texto plano de un HTML: fuera scripts, estilos y etiquetas."""
    crudo = datos.decode("utf-8", "ignore")
    sin_js = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", crudo, flags=re.S | re.I)
    sin_tags = re.sub(r"<[^>]+>", " ", sin_js)
    return re.sub(r"\s+", " ", html.unescape(sin_tags)).strip()


def leer_manual(url: str):
    """
    Descarga y extrae el texto del manual. Usa caché en disco.

    Devuelve una tupla (texto, motivo):
      • (texto, None)   → se pudo leer.
      • (None, motivo)  → no se pudo, con la razón en lenguaje claro para que
                          Mara se la explique al cliente y le dé el enlace.
    """
    if not url:
        return None, "el producto no tiene manual publicado"

    ruta = _ruta_cache(url)
    if os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as f:
            return f.read(), None

    try:
        r = requests.get(url, headers=HEADERS, allow_redirects=True, timeout=TIMEOUT)
    except requests.RequestException:
        return None, "no se pudo descargar el manual"
    if r.status_code != 200:
        return None, f"el manual respondió HTTP {r.status_code}"

    es_pdf = "pdf" in r.headers.get("content-type", "").lower() or url.lower().endswith(".pdf")
    if es_pdf:
        texto = _pdf_a_texto(r.content)
    else:
        texto = _html_a_texto(r.content)
        if len(texto.split()) < MIN_PALABRAS_HTML:
            return None, "manual interactivo (no legible sin navegador)"

    texto = texto.strip()
    if len(texto.split()) < MIN_PALABRAS_UTILES:
        return None, "no se pudo extraer texto útil del manual"

    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(texto)
    return texto, None


# ---------------------------------------------------------------------------
# Recuperación de fragmentos (el RAG)
# ---------------------------------------------------------------------------

# El cliente casi nunca usa la palabra del manual: dice "conector" donde el
# manual dice "conexión eléctrica". Este puente es lo que hace que el RAG
# encuentre algo en vez de devolver vacío.
SINONIMOS = {
    "conector": ["conexion", "enchufe", "toma", "electrica", "instalacion", "cable", "voltaje", "clavija"],
    "conectar": ["conexion", "enchufe", "instalacion", "electrica"],
    "enchufe": ["toma", "conexion", "clavija", "electrica"],
    "voltaje": ["voltios", "electrica", "tension", "corriente"],
    "pared": ["instalacion", "conexion", "toma", "ubicacion"],
    "instalar": ["instalacion", "montaje", "conexion", "ubicacion"],
    "instalacion": ["instalar", "montaje", "ubicacion", "conexion"],
    "ubicar": ["ubicacion", "lugar", "espacio", "instalacion"],
    "nivelar": ["nivelacion", "patas", "horizontal", "instalacion"],
    "secar": ["secado", "secadora", "seca"],
    "secado": ["secar", "secadora", "seca"],
    "secando": ["secado", "secar", "seca", "secadora"],
    "lavar": ["lavado", "lavadora"],
    "lavando": ["lavado", "lavadora", "lava"],
    "filtro": ["filtros", "limpieza", "mantenimiento"],
    "limpiar": ["limpieza", "mantenimiento", "lavar"],
    "mantenimiento": ["limpieza", "cuidado", "periodicamente"],
    "ruido": ["ruidoso", "vibracion", "sonido", "vibra"],
    "agua": ["desague", "drenaje", "suministro", "fuga"],
    "frio": ["enfria", "refrigeracion", "temperatura", "congela"],
    "gas": ["refrigerante", "fuga", "valvula"],
    "error": ["falla", "codigo", "problema", "solucion"],
    "problema": ["solucion", "falla", "averia", "advertencia"],

    # Formas verbales tal como las dice el cliente. El manual nunca escribe
    # "enfriando": escribe "refrigeración" o "enfría". Sin este puente, un
    # reporte de falla legítimo ("no está enfriando bien") puntúa casi cero.
    "enfria": ["enfriamiento", "refrigeracion", "temperatura", "frio", "congela"],
    "enfriar": ["enfriamiento", "refrigeracion", "temperatura", "frio", "congela"],
    "enfriando": ["enfriamiento", "refrigeracion", "temperatura", "frio", "congela", "enfria"],
    "calienta": ["calentamiento", "temperatura", "caliente", "calor"],
    "calentando": ["calentamiento", "temperatura", "caliente", "calor"],
    "prende": ["encendido", "encender", "enciende", "arranque"],
    "prender": ["encendido", "encender", "enciende", "arranque"],
    "enciende": ["encendido", "encender", "arranque"],
    "apaga": ["apagado", "apagar", "desconecte"],
    "gotea": ["fuga", "agua", "drenaje", "condensado", "escurre"],
    "huele": ["olor", "quemado", "advertencia", "seguridad"],
    "vibra": ["vibracion", "nivelacion", "ruido", "patas"],
    "suena": ["ruido", "sonido", "vibracion"],
}

# Si el cliente reporta un problema, empujamos las secciones de solución de
# problemas y advertencias, que es donde el manual trae el diagnóstico.
SENALES_PROBLEMA = ["no ", "raro", "mal", "falla", "error", "problema", "no funciona", "dejo de"]
TERMINOS_SOLUCION = ["solucion", "problema", "falla", "advertencia", "importante", "verifique", "asegurese"]


def _norm(texto: str) -> str:
    """
    Minúsculas y sin tildes, para que los acentos no estorben al comparar.

    ⚠️ Preserva la LONGITUD: devuelve exactamente un carácter por cada carácter
    de entrada. Es imprescindible — abajo puntuamos sobre el texto normalizado
    pero devolvemos el fragmento del texto ORIGINAL usando el mismo índice. Si
    la normalización acortara la cadena (como hace un NFKD ingenuo, que borra
    una tilde y con ella un carácter), los índices se desalinearían y
    devolveríamos un fragmento distinto del que puntuó.
    """
    salida = []
    for caracter in texto:
        descompuesto = unicodedata.normalize("NFKD", caracter)
        base = "".join(c for c in descompuesto if not unicodedata.combining(c))
        salida.append((base[:1] or caracter).lower())
    return "".join(salida)


# Palabras de relleno que aparecen en CUALQUIER manual y por lo tanto no
# discriminan nada. Sin este filtro, "¿puedo conectarlo a la wifi de mi casa?"
# puntúa alto por 'puedo' y 'casa', y el RAG devuelve fragmentos irrelevantes en
# vez de admitir que el manual no cubre el tema. Eso rompería la regla de oro:
# Mara necesita poder llegar a "esto no está en el manual".
STOPWORDS = {
    "cada", "cuanto", "cuanta", "como", "donde", "cuando", "porque", "para",
    "puedo", "puede", "debo", "debe", "tengo", "tiene", "hace", "hacer",
    "quiero", "necesito", "favor", "gracias", "ayuda", "ayudar", "mucho",
    "casa", "mio", "mia", "esta", "este", "esto", "eso", "ese", "muy",
    "pero", "unos", "unas", "algo", "nada", "todo", "toda", "sobre",
}


def _claves_de(pregunta: str) -> set:
    """
    Palabras clave de la pregunta (normalizadas), sin relleno, más sinónimos.

    Los sinónimos se agregan DESPUÉS de filtrar, porque son términos del dominio
    y siempre discriminan.
    """
    palabras = set(re.findall(r"\w{4,}", _norm(pregunta))) - STOPWORDS
    claves = set(palabras)
    for palabra in palabras:
        claves.update(SINONIMOS.get(palabra, []))
    return claves


def _es_relevante(repeticiones: int, distintas: int) -> bool:
    """
    ¿Este fragmento habla de verdad del tema, o solo coincidió por casualidad?

    Umbral calibrado midiendo puntajes reales sobre el manual del aire 9.000 BTU:
      • Preguntas que el manual SÍ cubre  → 8–11 repeticiones, 3–4 claves distintas.
      • Preguntas ajenas al manual        → 1–3 repeticiones, 1 sola clave.

    Así que pedimos DOS claves distintas, o una sola pero insistente. Un
    fragmento que coincide una vez con una palabra es ruido: dejarlo pasar haría
    que Mara reciba texto irrelevante y se vea tentada a estirarlo, en vez de
    admitir que el manual no cubre el tema.
    """
    return distintas >= 2 or repeticiones >= 4


def buscar_secciones(texto: str, pregunta: str, ventana: int = 700, top: int = 4) -> list:
    """
    Devuelve los fragmentos del manual más relevantes para la pregunta.

    Es lo que se le pasa al LLM como contexto: NO el manual completo (16.000
    palabras saturarían el contexto), solo los trozos que importan.

    Recorre el manual en ventanas solapadas, puntúa cada una por coincidencia de
    palabras clave, y devuelve las mejores evitando que se repitan entre sí.
    """
    if not texto:
        return []

    claves = _claves_de(pregunta)
    if not claves:
        return []

    es_problema = any(senal in _norm(pregunta) for senal in SENALES_PROBLEMA)
    texto_norm = _norm(texto)  # misma longitud que 'texto': ver _norm()

    # Ventanas solapadas (paso = mitad) para no partir en dos una sección útil.
    paso = ventana // 2
    puntuados = []
    for inicio in range(0, len(texto), paso):
        fragmento = texto_norm[inicio:inicio + ventana]
        repeticiones = sum(fragmento.count(clave) for clave in claves)
        distintas = sum(1 for clave in claves if clave in fragmento)

        if not _es_relevante(repeticiones, distintas):
            continue

        score = repeticiones
        if es_problema:
            score += sum(fragmento.count(termino) for termino in TERMINOS_SOLUCION)
        puntuados.append((score, inicio))

    puntuados.sort(key=lambda par: par[0], reverse=True)

    # Como las ventanas se solapan, las mejores suelen ser vecinas y traerían
    # casi el mismo texto. Nos quedamos con regiones distintas del manual.
    elegidos = []
    for score, inicio in puntuados:
        if any(abs(inicio - ya) < ventana for ya in elegidos):
            continue
        elegidos.append(inicio)
        if len(elegidos) == top:
            break

    elegidos.sort()  # devolverlos en el orden del manual se lee mejor
    return [texto[i:i + ventana].strip() for i in elegidos]


# ---------------------------------------------------------------------------
# Verificación a mano (Etapa 2): leer un manual real y buscar en él.
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import vtex_client

    # 882 = Aire Acondicionado On-Off Haceb 9.000 BTU 110V (manual en PDF)
    PRODUCT_ID = "882"
    PREGUNTA = "cada cuánto debo limpiar el filtro"

    ficha = vtex_client.obtener_ficha(PRODUCT_ID)
    if not ficha:
        raise SystemExit("❌ No se pudo traer la ficha del producto.")

    print(f"\n📦 {ficha['nombre']}")
    print(f"📄 Manual: {ficha['manual_url']}\n")

    ya_cacheado = os.path.exists(_ruta_cache(ficha["manual_url"]))  # antes de leer
    texto, motivo = leer_manual(ficha["manual_url"])
    if not texto:
        raise SystemExit(f"❌ No se pudo leer el manual: {motivo}")

    print(f"✅ Manual leído: {len(texto.split()):,} palabras "
          f"({'desde caché' if ya_cacheado else 'descargado ahora'})")

    print(f"\n🔎 Pregunta: {PREGUNTA!r}\n")
    fragmentos = buscar_secciones(texto, PREGUNTA)

    if not fragmentos:
        raise SystemExit("❌ El RAG no encontró fragmentos relevantes.")

    for i, frag in enumerate(fragmentos, 1):
        print(f"  ── Fragmento {i} " + "─" * 45)
        print("  " + frag[:320].replace("\n", " ") + "…\n")

    print(f"✅ Etapa 2 lista: {len(fragmentos)} fragmentos recuperados del manual real.")
