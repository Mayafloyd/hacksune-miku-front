"""
vtex_client.py — Cliente puro para la API de catálogo VTEX (Haceb / Éxito).

Funciones puras que devuelven datos (no imprimen nada).
Incluye caché en memoria de 5 minutos para no saturar la API.
"""

import time
import urllib.parse
import re
import requests

# ---------------------------------------------------------------------------
# Configuración de tiendas
# ---------------------------------------------------------------------------
TIENDAS = {
    "haceb": "https://www.haceb.com",
    "exito": "https://www.exito.com",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def _texto_limpio(value) -> str:
    """Quita HTML y espacios repetidos de campos de catálogo VTEX."""
    if not value:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(value))).strip()

ORDENES_VALIDAS = {
    "relevancia": "",
    "precio_asc": "OrderByPriceASC",
    "precio_desc": "OrderByPriceDESC",
    "mas_vendidos": "OrderByTopSaleDESC",
    "nombre_az": "OrderByNameASC",
}

# ---------------------------------------------------------------------------
# Caché simple en memoria (key → (timestamp, data))
# ---------------------------------------------------------------------------
_cache: dict[str, tuple[float, any]] = {}
CACHE_TTL = 300  # 5 minutos


def _cache_get(key: str):
    """Devuelve el dato cacheado o None si expiró / no existe."""
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
        del _cache[key]
    return None


def _cache_set(key: str, data):
    _cache[key] = (time.time(), data)


# ---------------------------------------------------------------------------
# Construcción de URL
# ---------------------------------------------------------------------------
def construir_url(base: str, ft=None, filtros=None, orden="", desde=0, hasta=19) -> str:
    """
    Arma la URL de búsqueda respetando las reglas del firewall VTEX:
    - Espacios como %20 (no +)
    - Corchetes literales en filtros de precio
    """
    endpoint = f"{base}/api/catalog_system/pub/products/search"
    partes = []

    if ft:
        partes.append("ft=" + urllib.parse.quote(ft, safe=""))
    for f in (filtros or []):
        partes.append("fq=" + urllib.parse.quote(f, safe=":/[]"))
    if orden:
        partes.append("O=" + orden)
    partes.append(f"_from={desde}")
    partes.append(f"_to={hasta}")

    return endpoint + "?" + "&".join(partes)


# ---------------------------------------------------------------------------
# Consultas a la API
# ---------------------------------------------------------------------------
def consultar(url: str) -> tuple[list[dict], str | None]:
    """
    Ejecuta la petición y devuelve (lista_productos_normalizados, error).
    HTTP 206 se trata como éxito (paginación VTEX).
    """
    cached = _cache_get(url)
    if cached is not None:
        return cached, None

    try:
        r = requests.get(url, headers=HEADERS, allow_redirects=True, timeout=25)
    except requests.RequestException as e:
        return [], f"Error de red: {e}"

    if r.status_code not in (200, 206):
        cuerpo = r.text[:120].strip()
        return [], f"HTTP {r.status_code} — {cuerpo}"

    try:
        crudos = r.json()
    except ValueError:
        return [], "La respuesta no es JSON válido."

    productos = []
    for p in crudos:
        try:
            sku = p["items"][0]
            oferta = sku["sellers"][0]["commertialOffer"]
            imagen = sku["images"][0]["imageUrl"] if sku.get("images") else None
        except (IndexError, KeyError):
            continue
        productos.append({
            "productId": p.get("productId"),
            "nombre": p.get("productName"),
            "marca": p.get("brand"),
            "referencia": p.get("productReference") or p.get("linkText") or p.get("productId"),
            "slug": p.get("linkText") or p.get("productId"),
            "url": p.get("link") or f"{TIENDAS.get('haceb', 'https://www.haceb.com')}/{p.get('linkText', '')}",
            "descripcion": _texto_limpio(p.get("description")),
            "precio": oferta.get("Price"),
            "precio_lista": oferta.get("ListPrice"),
            "stock": oferta.get("AvailableQuantity"),
            "disponible": oferta.get("IsAvailable"),
            "imagen": imagen,
            "categorias": p.get("categories", []),
            "especificaciones": p.get("specificationGroups", []),
        })

    _cache_set(url, productos)
    return productos, None


def buscar(
    texto: str,
    tienda: str = "haceb",
    precio_min: int | None = None,
    precio_max: int | None = None,
    orden: str = "",
    limite: int = 10,
) -> tuple[list[dict], str | None]:
    """
    Búsqueda de alto nivel. Devuelve (productos, error).
    `orden` puede ser una clave de ORDENES_VALIDAS o un valor directo de VTEX.
    """
    base = TIENDAS.get(tienda, TIENDAS["haceb"])
    orden_vtex = ORDENES_VALIDAS.get(orden, orden)

    filtros = []
    if precio_min is not None or precio_max is not None:
        pmin = precio_min or 0
        pmax = precio_max or 999999999
        filtros.append(f"P:[{pmin} TO {pmax}]")

    url = construir_url(base, ft=texto, filtros=filtros, orden=orden_vtex, hasta=limite - 1)
    return consultar(url)


def obtener_detalle(product_id: str, tienda: str = "haceb") -> dict | None:
    """
    Trae la ficha completa de un producto por su productId.
    Devuelve el dict crudo de VTEX o None si falla.
    """
    base = TIENDAS.get(tienda, TIENDAS["haceb"])
    url = f"{base}/api/catalog_system/pub/products/search?fq=productId:{product_id}"

    cached = _cache_get(url)
    if cached is not None:
        return cached

    try:
        r = requests.get(url, headers=HEADERS, allow_redirects=True, timeout=25)
        if r.status_code not in (200, 206):
            return None
        datos = r.json()
        if datos:
            _cache_set(url, datos[0])
            return datos[0]
        return None
    except (requests.RequestException, ValueError):
        return None


def arbol_categorias(tienda: str = "haceb", profundidad: int = 2) -> list[dict]:
    """Devuelve el árbol de categorías de la tienda."""
    base = TIENDAS.get(tienda, TIENDAS["haceb"])
    url = f"{base}/api/catalog_system/pub/category/tree/{profundidad}"

    cached = _cache_get(url)
    if cached is not None:
        return cached

    try:
        r = requests.get(url, headers=HEADERS, allow_redirects=True, timeout=25)
        if r.status_code in (200, 206):
            data = r.json()
            _cache_set(url, data)
            return data
    except requests.RequestException:
        pass
    return []
