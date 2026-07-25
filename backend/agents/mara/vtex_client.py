"""
vtex_client.py — Cliente de la API pública de catálogo VTEX de Haceb.

Es la capa de datos de Mara: la usan sus herramientas, y no sabe nada del agente
ni del LLM. Funciones PURAS — devuelven datos, no imprimen nada.

⚠️ Dos cosas aprendidas a golpes con esta API (ver mara/MARA.md §8):
  1. Los espacios van como %20, NUNCA como '+'. El firewall de Haceb responde
     HTTP 400 ("Scripts are not allowed!") si ve un '+'.
  2. Al paginar la API responde HTTP 206. Es un éxito, no un error.

Verificar a mano:  ./venv/bin/python mara/vtex_client.py
"""

import html
import re
import urllib.parse
import warnings

warnings.filterwarnings("ignore")  # silencia el aviso de versión de urllib3
import requests

BASE = "https://www.haceb.com"
TIMEOUT = 25

# Sin User-Agent de navegador la API responde de forma inconsistente.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

# Caché en memoria (url -> json). Evita repetir peticiones dentro de una misma
# conversación: el agente consulta la misma ficha varias veces.
_cache = {}


def _get_json(url: str):
    """GET con caché y User-Agent. Devuelve el JSON, o None si algo falló."""
    if url in _cache:
        return _cache[url]
    try:
        r = requests.get(url, headers=HEADERS, allow_redirects=True, timeout=TIMEOUT)
        if r.status_code not in (200, 206):  # 206 = éxito al paginar
            return None
        datos = r.json()
    except (requests.RequestException, ValueError):
        return None
    _cache[url] = datos
    return datos


def _primer(valor):
    """
    Muchos campos de VTEX llegan como lista aunque tengan un solo valor
    (ej. 'Manual de uso link': ['https://...']). Devuelve el valor de adentro.
    """
    if isinstance(valor, list):
        return valor[0] if valor else None
    return valor


def _limpiar_html(texto: str) -> str:
    """Quita etiquetas y normaliza espacios: las descripciones vienen en HTML."""
    sin_tags = re.sub(r"<[^>]+>", " ", texto or "")
    return re.sub(r"\s+", " ", html.unescape(sin_tags)).strip()


def buscar_productos(texto: str, limite: int = 5) -> list:
    """
    Busca productos por texto libre. Sirve para identificar el modelo del cliente.

    Devuelve una lista de dicts con productId, nombre, marca, precio y disponible.
    Lista vacía si no hay resultados o si la petición falló.
    """
    ft = urllib.parse.quote(texto, safe="")  # quote(), no quote_plus(): ver cabecera
    url = (f"{BASE}/api/catalog_system/pub/products/search"
           f"?ft={ft}&_from=0&_to={max(limite - 1, 0)}")

    productos = []
    for p in _get_json(url) or []:
        try:
            oferta = p["items"][0]["sellers"][0]["commertialOffer"]
        except (IndexError, KeyError, TypeError):
            oferta = {}
        productos.append({
            "productId": p.get("productId"),
            "nombre": p.get("productName"),
            "marca": p.get("brand"),
            "precio": oferta.get("Price"),
            "disponible": oferta.get("IsAvailable"),
        })
    return productos


def obtener_producto(product_id: str):
    """Devuelve el objeto CRUDO y completo de un producto, o None."""
    url = f"{BASE}/api/catalog_system/pub/products/search?fq=productId:{product_id}"
    datos = _get_json(url)
    return datos[0] if datos else None


# Especificaciones técnicas que el cliente pregunta de verdad: "¿me cabe en el
# cajón?", "¿aguanta mi instalación eléctrica?". Están en la API, pero VTEX no
# usa un nombre único por categoría, así que probamos varios alias en orden.
# (Los campos FALA_* son del marketplace de Falabella: sirven de respaldo.)
SPECS_TECNICAS = {
    "alto": ["Alto", "Altura", "FALA_Alto"],
    "ancho": ["Ancho", "FALA_Ancho"],
    "profundo": ["Profundo", "Profundidad", "Fondo", "FALA_Profundidad"],
    "peso": ["Peso", "FALA_Peso"],
    "voltaje": ["Voltaje", "FALA_Voltaje"],
    "potencia_entrada": ["Potencia de entrada (W)"],
    "potencia_salida": ["Potencia de salida (W)", "FALA_Potencia"],
    "frecuencia": ["Frecuencia"],
}


def _extraer_specs(producto: dict) -> dict:
    """Toma las especificaciones técnicas, probando los alias de cada categoría."""
    specs = {}
    for clave, alias in SPECS_TECNICAS.items():
        for nombre in alias:
            valor = _primer(producto.get(nombre))
            if valor:
                specs[clave] = str(valor).strip()
                break
    return specs


def _extraer_capacidades(producto: dict) -> dict:
    """
    Capacidades del producto. Una nevera publica varias (bruta, neta, del
    congelador, del refrigerador), así que las devolvemos todas con su nombre
    original en vez de elegir una por el cliente.
    """
    capacidades = {}
    for campo, valor in producto.items():
        if campo.lower().startswith("capacidad") and not campo.startswith("FALA_"):
            texto = _primer(valor)
            if texto:
                capacidades[campo] = str(texto).strip()
    return capacidades


def _armar_dimensiones(specs: dict):
    """
    Junta alto/ancho/profundo en una sola frase legible.

    Le ahorra al agente tener que componerla, y sobre todo deja explícito qué
    medida es cuál: '185,6 x 71 x 75,3' sin etiquetas se malinterpreta fácil.
    """
    partes = [(specs.get("alto"), "alto"),
              (specs.get("ancho"), "ancho"),
              (specs.get("profundo"), "profundo")]
    presentes = [f"{valor} de {etiqueta}" for valor, etiqueta in partes if valor]
    return " × ".join(presentes) if presentes else None


def _extraer_garantias(producto: dict) -> list:
    """
    Recoge las garantías del producto.

    VTEX no usa un nombre de campo fijo para esto ('Garantía', 'Garantia
    Comercial', ...), así que barremos todo campo cuyo nombre contenga 'garant'.
    Descartamos los que son solo un número (son códigos internos, no texto útil
    para el cliente) y deduplicamos, porque el mismo texto suele repetirse.
    """
    garantias, vistos = [], set()
    for campo, valor in producto.items():
        if "garant" not in campo.lower():
            continue
        texto = _primer(valor)
        if not texto or str(texto).strip().isdigit():
            continue
        clave = str(texto).strip().lower()
        if clave not in vistos:
            vistos.add(clave)
            garantias.append(str(texto))
    return garantias


def obtener_ficha(product_id: str):
    """
    Ficha de soporte lista para el agente: identidad, garantías, datos de energía
    y la URL del manual. Devuelve None si el producto no existe.

    'manual_url' puede venir en None (el producto no publicó manual) — quien la
    use debe manejar ese caso, no asumir que siempre hay manual.
    """
    p = obtener_producto(product_id)
    if not p:
        return None

    def campo(nombre):
        return _primer(p.get(nombre))

    specs = _extraer_specs(p)

    return {
        "productId": p.get("productId"),
        "nombre": p.get("productName"),
        "marca": p.get("brand"),
        "codigo": campo("Código"),
        "referencia": campo("Referencia"),
        "ean": campo("EAN"),
        "garantias": _extraer_garantias(p),
        "consumo_energia": campo("Consumo Energía"),
        "clasificacion_energetica": campo("Clasificación energetica"),
        "manual_url": campo("Manual de uso link"),
        "descripcion": _limpiar_html(p.get("description")),
        # Medidas y datos eléctricos: lo que se necesita para saber si el
        # producto cabe en un espacio y si la instalación lo soporta.
        "dimensiones": _armar_dimensiones(specs),
        "specs": specs,
        "capacidades": _extraer_capacidades(p),
    }


# ---------------------------------------------------------------------------
# Verificación a mano (Etapa 0): busca un producto real y muestra su ficha.
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    CONSULTA = "aire acondicionado"

    print(f"\n🔍 Buscando: {CONSULTA!r}\n")
    encontrados = buscar_productos(CONSULTA, limite=5)

    if not encontrados:
        raise SystemExit("❌ Sin resultados. ¿Hay internet? ¿Cambió la API?")

    for i, prod in enumerate(encontrados, 1):
        estado = "disponible" if prod["disponible"] else "agotado"
        print(f"  {i}. [{prod['productId']}] {prod['nombre']}  ({estado})")

    primero = encontrados[0]
    print(f"\n📋 Ficha del primero — productId {primero['productId']}\n")
    ficha = obtener_ficha(primero["productId"])

    if not ficha:
        raise SystemExit("❌ No se pudo traer la ficha.")

    print(f"  Nombre:      {ficha['nombre']}")
    print(f"  Marca:       {ficha['marca']}")
    print(f"  Código:      {ficha['codigo']}")
    print(f"  Garantías:   {ficha['garantias'] or '(ninguna publicada)'}")
    print(f"  Energía:     {ficha['consumo_energia']} · clase {ficha['clasificacion_energetica']}")
    print(f"  Manual:      {ficha['manual_url'] or '(no publica manual)'}")

    # La prueba de fuego del bug del '+': una búsqueda de varias palabras.
    print(f"\n✅ Etapa 0 lista: búsqueda multi-palabra OK ({len(encontrados)} resultados).")
