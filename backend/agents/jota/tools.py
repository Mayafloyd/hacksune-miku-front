"""
tools.py — Herramientas del agente + declaraciones JSON para Gemini Function Calling.

Cada herramienta es una función Python que el agente puede invocar.
Las declaraciones (TOOL_DECLARATIONS) se pasan a Gemini para que sepa qué puede llamar.
"""

import json
import re
try:
    from .cotizacion import Cotizacion
    from .vtex_client import buscar, obtener_detalle, arbol_categorias
    from .rag import buscar_en_conocimiento, obtener_categorias_resumen
except ImportError:  # Compatibilidad con la ejecución directa.
    from cotizacion import Cotizacion
    from vtex_client import buscar, obtener_detalle, arbol_categorias
    from rag import buscar_en_conocimiento, obtener_categorias_resumen

# ---------------------------------------------------------------------------
# Estado global de la cotización (una por sesión)
# ---------------------------------------------------------------------------
cotizacion_activa = Cotizacion()


# ---------------------------------------------------------------------------
# 1. buscar_productos
# ---------------------------------------------------------------------------
def buscar_productos(
    texto: str,
    precio_min: int | None = None,
    precio_max: int | None = None,
    orden: str | None = None,
    limite: int = 8,
    tienda: str = "haceb",
) -> str:
    """Busca productos en el catálogo de Haceb/Éxito. Devuelve JSON."""
    productos, error = buscar(
        texto=texto,
        tienda=tienda,
        precio_min=precio_min,
        precio_max=precio_max,
        orden=orden or "",
        limite=min(limite, 20),
    )
    if error:
        return json.dumps({"error": error}, ensure_ascii=False)

    # Formato resumido para el agente
    resumen = []
    for p in productos:
        item = {
            "productId": p["productId"],
            "nombre": p["nombre"],
            "marca": p["marca"],
            "referencia": p.get("referencia"),
            "slug": p.get("slug"),
            "url": p.get("url"),
            "descripcion": p.get("descripcion"),
            "precio": p["precio"],
            "disponible": p["disponible"],
            "stock": p["stock"],
        }
        if p.get("imagen"):
            item["imagen"] = p["imagen"]
        if p.get("precio_lista") and p["precio_lista"] > (p["precio"] or 0):
            item["precio_lista"] = p["precio_lista"]
            ahorro_pct = round((1 - p["precio"] / p["precio_lista"]) * 100)
            item["descuento"] = f"-{ahorro_pct}%"
        resumen.append(item)

    return json.dumps(
        {"busqueda": texto, "resultados": len(resumen), "productos": resumen},
        ensure_ascii=False,
    )


# ---------------------------------------------------------------------------
# 2. obtener_detalle_producto
# ---------------------------------------------------------------------------
def obtener_detalle_producto(product_id: str, tienda: str = "haceb") -> str:
    """Trae la ficha técnica completa de un producto por su productId."""
    detalle = obtener_detalle(product_id, tienda)
    if not detalle:
        return json.dumps({"error": f"No se pudo obtener el detalle del producto {product_id}"})

    # Extraer specs interesantes
    specs_interes = [
        "Capacidad neta en litros", "Capacidad", "Consumo Energía",
        "Clasificación energetica", "Potencia", "Alto", "Ancho", "Profundo",
        "Peso", "Color", "Material", "Cantidad Puertas", "Tipo de Refrigeración",
        "Voltaje", "Garantía", "País de origen",
    ]

    specs = {}
    for campo in specs_interes:
        val = detalle.get(campo)
        if val:
            if isinstance(val, list):
                val = " | ".join(str(x) for x in val)
            specs[campo] = val

    # Descripción limpia
    desc = (detalle.get("description") or "")
    desc = re.sub(r"<[^>]+>", "", desc).strip()
    if len(desc) > 500:
        desc = desc[:500] + "..."

    resultado = {
        "productId": detalle.get("productId"),
        "nombre": detalle.get("productName"),
        "marca": detalle.get("brand"),
        "referencia": detalle.get("productReference"),
        "especificaciones": specs if specs else "No disponibles",
        "descripcion": desc if desc else "No disponible",
    }

    # Imagen del producto
    try:
        imagen = detalle["items"][0]["images"][0]["imageUrl"]
        if imagen:
            resultado["imagen"] = imagen
    except (IndexError, KeyError):
        pass

    # Precio del primer seller
    try:
        oferta = detalle["items"][0]["sellers"][0]["commertialOffer"]
        resultado["precio"] = oferta.get("Price")
        resultado["precio_lista"] = oferta.get("ListPrice")
        resultado["stock"] = oferta.get("AvailableQuantity")
        resultado["disponible"] = oferta.get("IsAvailable")
    except (IndexError, KeyError):
        pass

    return json.dumps(resultado, ensure_ascii=False)


# ---------------------------------------------------------------------------
# 3. gestionar_cotizacion
# ---------------------------------------------------------------------------
def gestionar_cotizacion(
    accion: str,
    product_id: str | None = None,
    nombre: str | None = None,
    marca: str | None = None,
    precio_unitario: float | None = None,
    cantidad: int | None = None,
    espacio: str | None = None,
    precio_lista: float | None = None,
    nota: str | None = None,
    nueva_cantidad: int | None = None,
    cliente: str | None = None,
) -> str:
    """
    Gestiona la cotización activa.
    Acciones: 'agregar', 'quitar', 'cambiar_cantidad', 'ver', 'limpiar', 'set_cliente'.
    """
    global cotizacion_activa

    if accion == "agregar":
        if not all([product_id, nombre, marca, precio_unitario, cantidad, espacio]):
            return json.dumps({"error": "Faltan campos obligatorios: product_id, nombre, marca, precio_unitario, cantidad, espacio"})
        msg = cotizacion_activa.agregar(
            product_id=product_id,
            nombre=nombre,
            marca=marca,
            precio_unitario=precio_unitario,
            cantidad=cantidad,
            espacio=espacio,
            precio_lista=precio_lista,
            nota=nota or "",
        )
        return json.dumps({"ok": msg, "total_actual": cotizacion_activa.total}, ensure_ascii=False)

    elif accion == "quitar":
        if not product_id:
            return json.dumps({"error": "Falta product_id"})
        msg = cotizacion_activa.quitar(product_id, espacio)
        return json.dumps({"ok": msg, "total_actual": cotizacion_activa.total}, ensure_ascii=False)

    elif accion == "cambiar_cantidad":
        if not product_id or nueva_cantidad is None:
            return json.dumps({"error": "Faltan product_id o nueva_cantidad"})
        msg = cotizacion_activa.cambiar_cantidad(product_id, nueva_cantidad, espacio)
        return json.dumps({"ok": msg, "total_actual": cotizacion_activa.total}, ensure_ascii=False)

    elif accion == "ver":
        return json.dumps(cotizacion_activa.ver(), ensure_ascii=False)

    elif accion == "limpiar":
        msg = cotizacion_activa.limpiar()
        return json.dumps({"ok": msg}, ensure_ascii=False)

    elif accion == "set_cliente":
        if cliente:
            cotizacion_activa.cliente = cliente
        return json.dumps({"ok": f"Cliente establecido: {cotizacion_activa.cliente}"}, ensure_ascii=False)

    else:
        return json.dumps({"error": f"Acción desconocida: {accion}. Usa: agregar, quitar, cambiar_cantidad, ver, limpiar, set_cliente"})


# ---------------------------------------------------------------------------
# 4. generar_documento
# ---------------------------------------------------------------------------
def generar_documento() -> str:
    """Genera la cotización en formato Markdown lista para entregar."""
    if not cotizacion_activa.items:
        return json.dumps({"error": "La cotización está vacía. Agrega productos antes de generar el documento."})

    md = cotizacion_activa.a_markdown()

    # Guardar a archivo
    filename = f"cotizacion_{cotizacion_activa.creada.strftime('%Y%m%d_%H%M')}.md"
    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(md)
        return json.dumps({
            "ok": f"Documento generado: {filename}",
            "contenido": md,
        }, ensure_ascii=False)
    except IOError as e:
        return json.dumps({"error": f"No se pudo guardar el archivo: {e}", "contenido": md}, ensure_ascii=False)


# ---------------------------------------------------------------------------
# 5. consultar_catalogo (RAG - conocimiento local)
# ---------------------------------------------------------------------------
def consultar_catalogo(consulta: str | None = None, categoria: str | None = None) -> str:
    """
    Consulta la base de conocimiento local del catálogo de Haceb.
    Devuelve info general sobre categorías, tipos de productos, características
    y preguntas clave para cotizar. NO llama al API.
    """
    if consulta:
        resultado = buscar_en_conocimiento(consulta)
        return json.dumps(resultado, ensure_ascii=False)
    elif categoria:
        resultado = buscar_en_conocimiento(categoria)
        return json.dumps(resultado, ensure_ascii=False)
    else:
        # Sin consulta específica → devolver resumen de todas las categorías
        categorias = obtener_categorias_resumen()
        return json.dumps(
            {"mensaje": "Estas son todas las categorías disponibles", "categorias": categorias},
            ensure_ascii=False,
        )


# ---------------------------------------------------------------------------
# Declaraciones de herramientas para Gemini (Function Calling)
# ---------------------------------------------------------------------------
TOOL_DECLARATIONS = [
    {
        "name": "buscar_productos",
        "description": (
            "Busca productos en el catálogo de electrodomésticos de Haceb. "
            "Devuelve una lista con productId, nombre, marca, precio, stock, disponibilidad e imagen. "
            "Úsala para encontrar candidatos para cada necesidad del cliente. "
            "SOLO devuelve productos reales del catálogo de Haceb."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "texto": {
                    "type": "string",
                    "description": "Término de búsqueda (ej: 'nevera', 'aire acondicionado', 'lavadora')",
                },
                "precio_min": {
                    "type": "integer",
                    "description": "Precio mínimo en pesos colombianos (opcional)",
                },
                "precio_max": {
                    "type": "integer",
                    "description": "Precio máximo en pesos colombianos (opcional)",
                },
                "orden": {
                    "type": "string",
                    "description": "Ordenamiento: 'precio_asc', 'precio_desc', 'mas_vendidos', 'relevancia'",
                    "enum": ["relevancia", "precio_asc", "precio_desc", "mas_vendidos"],
                },
                "limite": {
                    "type": "integer",
                    "description": "Máximo de resultados a devolver (por defecto 8, máximo 20)",
                },
            },
            "required": ["texto"],
        },
    },
    {
        "name": "obtener_detalle_producto",
        "description": (
            "Obtiene la ficha técnica COMPLETA de un producto de Haceb: especificaciones (capacidad, consumo, "
            "dimensiones, potencia, garantía), precio, stock, descripción e imagen. "
            "Úsala cuando necesites comparar specs de varios candidatos para elegir el mejor."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {
                    "type": "string",
                    "description": "El productId del producto (obtenido de buscar_productos)",
                },
            },
            "required": ["product_id"],
        },
    },
    {
        "name": "gestionar_cotizacion",
        "description": (
            "Gestiona la cotización/BOM activa. Permite agregar productos, quitar, "
            "cambiar cantidades, ver el estado actual o limpiar. "
            "REGLA OBLIGATORIA: Solo usar accion='agregar' cuando el cliente haya CONFIRMADO "
            "explícitamente que desea incluir el producto en su cotización. "
            "NO la invoques para agregar productos de forma automática al buscar u ofrecer opciones."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "accion": {
                    "type": "string",
                    "description": "Acción a realizar",
                    "enum": ["agregar", "quitar", "cambiar_cantidad", "ver", "limpiar", "set_cliente"],
                },
                "product_id": {
                    "type": "string",
                    "description": "productId del producto (requerido para agregar/quitar/cambiar_cantidad)",
                },
                "nombre": {
                    "type": "string",
                    "description": "Nombre del producto (requerido al agregar)",
                },
                "marca": {
                    "type": "string",
                    "description": "Marca del producto (requerido al agregar)",
                },
                "precio_unitario": {
                    "type": "number",
                    "description": "Precio unitario en pesos (requerido al agregar)",
                },
                "cantidad": {
                    "type": "integer",
                    "description": "Cantidad de unidades (requerido al agregar)",
                },
                "espacio": {
                    "type": "string",
                    "description": "Espacio o zona donde irá el producto (ej: 'Habitaciones', 'Cocina industrial')",
                },
                "precio_lista": {
                    "type": "number",
                    "description": "Precio de lista original (si hay descuento, opcional)",
                },
                "nota": {
                    "type": "string",
                    "description": "Nota sobre la elección (ej: 'bajo consumo', 'mejor relación calidad-precio')",
                },
                "nueva_cantidad": {
                    "type": "integer",
                    "description": "Nueva cantidad (para cambiar_cantidad)",
                },
                "cliente": {
                    "type": "string",
                    "description": "Nombre del cliente (para set_cliente)",
                },
            },
            "required": ["accion"],
        },
    },
    {
        "name": "generar_documento",
        "description": (
            "Genera la cotización/orden de compra final en formato Markdown. "
            "Incluye todas las líneas agrupadas por espacio, precios, descuentos y totales. "
            "El documento se guarda como archivo .md. "
            "Solo úsala cuando la cotización esté COMPLETA y el cliente confirme."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "consultar_catalogo",
        "description": (
            "Consulta la base de conocimiento LOCAL del catálogo de Haceb. "
            "Devuelve info general sobre categorías de productos, tipos disponibles, "
            "características clave, usos típicos en B2B y preguntas importantes para cotizar. "
            "NO llama al API — usa datos locales. "
            "Úsala para responder preguntas generales sobre qué productos hay, "
            "qué categorías existen, o para obtener las preguntas clave que debes hacer al cliente "
            "antes de buscar productos específicos en el API."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "consulta": {
                    "type": "string",
                    "description": "Consulta de texto libre (ej: 'neveras', 'equipar cocina', 'hotel')",
                },
                "categoria": {
                    "type": "string",
                    "description": "Nombre exacto de la categoría (ej: 'Refrigeración', 'Cocina', 'Aires Acondicionados')",
                },
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Dispatcher: ejecuta la herramienta pedida por Gemini
# ---------------------------------------------------------------------------
def ejecutar_herramienta(nombre: str, args: dict) -> str:
    """
    Recibe el nombre de la función y sus argumentos (del function_call de Gemini)
    y ejecuta la herramienta correspondiente.
    """
    if nombre == "buscar_productos":
        return buscar_productos(**args)
    elif nombre == "obtener_detalle_producto":
        return obtener_detalle_producto(**args)
    elif nombre == "gestionar_cotizacion":
        return gestionar_cotizacion(**args)
    elif nombre == "generar_documento":
        return generar_documento()
    elif nombre == "consultar_catalogo":
        return consultar_catalogo(**args)
    else:
        return json.dumps({"error": f"Herramienta desconocida: {nombre}"})
