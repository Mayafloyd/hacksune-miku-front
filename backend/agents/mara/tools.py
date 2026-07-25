"""
tools.py — Las tres herramientas que Mara puede invocar.

Este módulo es la frontera entre el agente y los datos. El agente (el LLM) no
sabe que existe Haceb ni VTEX: solo sabe que tiene estas tres funciones.

Todas devuelven dicts/listas simples (serializables a JSON) porque el resultado
se le manda de vuelta al modelo. Y 'consultar_manual' devuelve SOLO los
fragmentos relevantes, no el manual completo: eso es lo que hace que quepa en el
contexto. Ahí está el RAG.

Verificar a mano:  ./venv/bin/python mara/tools.py
"""

import re

try:
    from . import docs_reader, vtex_client
except ImportError:  # Compatibilidad con la ejecución directa.
    import docs_reader
    import vtex_client

# Cuántos modelos ofrecerle al cliente cuando la búsqueda es ambigua. Más de 5
# abruma; menos arriesga no incluir el modelo que tiene en casa.
MAX_RESULTADOS = 5

# Palabras que el cliente dice al contar su problema pero que NO están en el
# nombre de ningún producto del catálogo. La API busca por texto sobre el nombre,
# así que "lavadora secadora con conector raro para la pared" da CERO resultados
# mientras "lavadora secadora" da uno. Sin este filtro, contar bien el problema
# hace que Mara no encuentre el producto.
PALABRAS_NO_PRODUCTO = {
    "hola", "buenas", "compre", "comprе", "tengo", "mi", "mis", "para", "con",
    "como", "que", "una", "uno", "unos", "unas", "del", "los", "las", "por",
    "pero", "raro", "raras", "extraño", "diferente", "problema", "ayuda",
    "ayudame", "ayudarme", "favor", "gracias", "pared", "luz", "casa", "cocina",
    "cajon", "cajón", "mueble", "nicho", "enchufe", "conector", "plug", "toma",
    "tomacorriente", "cable", "grande", "pequeño", "pequeña", "nuevo", "nueva",
    "recien", "recién", "sirve", "puedo", "sabes", "dime", "necesito", "quiero",
    "funciona", "anda", "esta", "este", "muy", "poco", "algo", "nada",
    # Verbos y conectores genéricos: "no sé qué hacer" no nombra un producto,
    # pero 'hacer' pasaría el filtro y la API le saca una lavadora cualquiera.
    "hacer", "saber", "decir", "poner", "poder", "usar", "tener", "estar",
    "ahora", "cuando", "donde", "porque", "tambien", "también", "tampoco",
    "entonces", "acaba", "acabo", "sucede", "pasando", "pasa",
}


def _intentos_de_busqueda(consulta: str):
    """
    Genera consultas de la más específica a la más general.

    El modelo suele pasarle a la búsqueda la frase entera del cliente. Como la
    API busca literalmente, una palabra de más devuelve cero resultados. Así que
    reintentamos acortando: frase completa → solo palabras de producto → las dos
    primeras → la primera.
    """
    vistos = set()

    def proponer(texto):
        texto = " ".join(texto.split()).strip()
        if not texto or texto.lower() in vistos:
            return None
        # Una consulta de solo artículos y preposiciones ("el de la") le saca a
        # la API productos al azar, y ofrecerle al cliente candidatos aleatorios
        # es peor que decirle que no encontramos nada.
        if not any(len(p) >= 4 or p.isdigit() for p in texto.split()):
            return None
        vistos.add(texto.lower())
        return texto

    palabras = [p for p in re.findall(r"[\wáéíóúñ]+", consulta.lower())
                if p.isdigit() or (len(p) >= 3 and p not in PALABRAS_NO_PRODUCTO)]

    # Si no queda ninguna palabra de producto, el cliente no nombró un
    # electrodoméstico: describió su problema. No buscamos nada. La búsqueda de
    # la API es laxa y con términos así devuelve productos al azar (buscar
    # "lavaplatos" saca un calentador), y mostrarle candidatos aleatorios lo
    # confundiría. Mejor que Mara le pregunte qué equipo es.
    if not palabras:
        return

    candidatos = [consulta, " ".join(palabras), " ".join(palabras[:3]),
                  " ".join(palabras[:2]), palabras[0]]

    for candidato in candidatos:
        texto = proponer(candidato)
        if texto:
            yield texto


def buscar_producto(consulta: str) -> list:
    """
    Busca productos de Haceb por nombre o descripción, para identificar el
    modelo del que habla el cliente.

    Args:
        consulta: qué buscar, ej. "aire acondicionado 9000 btu" o "lavadora".

    Returns:
        Lista de productos con productId, nombre y disponibilidad. Si trae más
        de uno, el agente debe PREGUNTARLE al cliente cuál es el suyo — nunca
        elegir por él: cada modelo tiene su propio manual.

        Si no encuentra nada, reintenta sola con términos más cortos antes de
        rendirse, así que una lista vacía significa que el catálogo de verdad no
        tiene ese producto.
    """
    for intento in _intentos_de_busqueda(consulta):
        encontrados = vtex_client.buscar_productos(intento, limite=MAX_RESULTADOS)
        if encontrados:
            return [
                {
                    "productId": p["productId"],
                    "nombre": p["nombre"],
                    "disponible": p["disponible"],
                }
                for p in encontrados
            ]
    return []


def obtener_informacion_producto(product_id: str) -> dict:
    """
    Trae la ficha técnica de un modelo ya identificado: garantía, MEDIDAS
    (alto/ancho/profundo), peso, VOLTAJE, potencia, capacidades y consumo.

    Es la fuente para garantía y también para las preguntas de espacio y de
    instalación eléctrica: "¿me cabe en el cajón?", "¿lo aguanta mi toma?".
    Esos datos están en la ficha, NO en el manual.

    Args:
        product_id: el productId del modelo confirmado.
    """
    ficha = vtex_client.obtener_ficha(product_id)
    if not ficha:
        return {"error": "No encontré ese producto en el catálogo."}

    info = {
        "nombre": ficha["nombre"],
        "codigo": ficha["codigo"],
        "referencia": ficha["referencia"],
        "garantias": ficha["garantias"],
        "consumo_energia": ficha["consumo_energia"],
        "clasificacion_energetica": ficha["clasificacion_energetica"],
        "tiene_manual": bool(ficha["manual_url"]),
    }

    # Solo incluimos lo que el producto de verdad publica: un campo vacío
    # invita al modelo a rellenarlo, y un dato eléctrico inventado es peligroso.
    if ficha["dimensiones"]:
        info["dimensiones"] = ficha["dimensiones"]
    if ficha["capacidades"]:
        info["capacidades"] = ficha["capacidades"]
    for clave, valor in ficha["specs"].items():
        if clave not in ("alto", "ancho", "profundo"):  # ya van en 'dimensiones'
            info[clave] = valor

    return info


def consultar_manual(product_id: str, pregunta: str) -> dict:
    """
    Lee el manual oficial del modelo y devuelve los fragmentos relevantes a la
    duda del cliente. Es la herramienta para instalación, mantenimiento, uso y
    solución de problemas.

    Args:
        product_id: el productId del modelo confirmado.
        pregunta: la duda del cliente, en sus propias palabras.

    Returns:
        Uno de tres casos, y el agente debe tratarlos DISTINTO:

        1. {"disponible": True, "fragmentos": [...]}
           Leyó el manual y encontró el tema → responder citándolo.

        2. {"disponible": True, "fragmentos": [], "nota": ...}
           Leyó el manual pero NO cubre el tema → admitirlo y escalar.
           Nunca rellenar el hueco con conocimiento general.

        3. {"disponible": False, "motivo": ..., "manual_url": ...}
           No se pudo leer (manual interactivo) → entregarle al cliente el
           enlace directo, SIN inventar procedimientos.
    """
    ficha = vtex_client.obtener_ficha(product_id)
    if not ficha:
        return {"disponible": False, "motivo": "no encontré ese producto en el catálogo"}

    texto, motivo = docs_reader.leer_manual(ficha["manual_url"])

    if not texto:
        # Caso 3: no lo pudimos leer. Pero si tenemos el enlace, el cliente no
        # tiene por qué quedarse sin nada: se lo damos para que lo abra él.
        resultado = {
            "disponible": False,
            "producto": ficha["nombre"],
            "motivo": motivo,
        }
        if ficha["manual_url"]:
            resultado["manual_url"] = ficha["manual_url"]
            resultado["sugerencia"] = (
                "Dile al cliente que el manual de ese modelo no se puede leer aquí, "
                "pásale este enlace directo para que lo abra en su navegador, y "
                "ofrécele ayuda con garantía o especificaciones. NO inventes pasos."
            )
        return resultado

    fragmentos = docs_reader.buscar_secciones(texto, pregunta)

    if not fragmentos:
        # Caso 2: el manual se leyó bien, pero no habla del tema.
        return {
            "disponible": True,
            "producto": ficha["nombre"],
            "fragmentos": [],
            "nota": ("el manual de este modelo no cubre ese tema; dile al cliente "
                     "que no está en el manual y escala al canal de servicio"),
        }

    # Caso 1: lo normal y lo que queremos.
    return {
        "disponible": True,
        "producto": ficha["nombre"],
        "fragmentos": fragmentos,
    }


# Las tres herramientas de Mara, en el orden en que las usa.
HERRAMIENTAS = [buscar_producto, obtener_informacion_producto, consultar_manual]


# ---------------------------------------------------------------------------
# Verificación a mano: los TRES casos de retorno de consultar_manual.
# ---------------------------------------------------------------------------
if __name__ == "__main__":

    def titulo(texto):
        print(f"\n{'═' * 62}\n  {texto}\n{'═' * 62}")

    titulo("1. buscar_producto — identificar el modelo")
    resultados = buscar_producto("aire acondicionado 9000 btu")
    for p in resultados:
        print(f"  [{p['productId']}] {p['nombre']}")
    assert resultados, "buscar_producto no devolvió nada"
    print(f"\n  → {len(resultados)} modelos. Con más de uno, Mara debe PREGUNTAR.")

    titulo("2. obtener_informacion_producto — garantía")
    info = obtener_informacion_producto("882")
    print(f"  Producto:  {info['nombre']}")
    print(f"  Garantías: {info['garantias']}")
    print(f"  Manual:    {'sí' if info['tiene_manual'] else 'no'}")
    assert info.get("garantias"), "no trajo garantías"

    titulo("3a. consultar_manual — CASO 1: manual legible, tema encontrado")
    caso1 = consultar_manual("882", "cada cuánto limpio el filtro")
    print(f"  disponible: {caso1['disponible']} · fragmentos: {len(caso1['fragmentos'])}")
    print(f"  muestra: …{caso1['fragmentos'][0][120:300].replace(chr(10), ' ')}…")
    assert caso1["disponible"] and caso1["fragmentos"], "el caso 1 falló"

    titulo("3b. consultar_manual — CASO 2: manual legible, tema NO cubierto")
    caso2 = consultar_manual("882", "puedo conectarlo a la wifi de mi casa")
    print(f"  disponible: {caso2['disponible']} · fragmentos: {len(caso2['fragmentos'])}")
    print(f"  nota: {caso2.get('nota', '(trajo fragmentos, el tema sí aparece)')}")

    titulo("3c. consultar_manual — CASO 3: manual interactivo ILEGIBLE")
    caso3 = consultar_manual("766", "cómo la conecto")  # nevera con manual HTML
    print(f"  disponible: {caso3['disponible']}")
    print(f"  motivo:     {caso3['motivo']}")
    print(f"  enlace:     {caso3.get('manual_url', '(sin enlace)')[:70]}…")
    assert caso3["disponible"] is False and caso3.get("manual_url"), "el caso 3 falló"

    print("\n✅ Las 3 herramientas responden, y los 3 casos del RAG se distinguen.\n")
