"""
rag.py — Motor RAG (Retrieval-Augmented Generation) para el agente de ventas.

Módulo autónomo y desacoplado que gestiona la base de conocimiento local (knowledge_base.json),
búsqueda por relevancia y generación de contexto para el LLM.
"""

import json
from pathlib import Path

_BASE_DIR = Path(__file__).parent
_DEFAULT_KB_PATH = _BASE_DIR / "knowledge_base.json"


class RAGEngine:
    """Motor RAG independiente para gestión de conocimiento local del catálogo."""

    def __init__(self, kb_path: Path | str | None = None):
        self.kb_path = Path(kb_path) if kb_path else _DEFAULT_KB_PATH
        self._conocimiento: dict | None = None
        self.cargar_conocimiento()

    def cargar_conocimiento(self) -> dict:
        """Carga y cachea la base de conocimiento desde el archivo JSON."""
        if self._conocimiento is not None:
            return self._conocimiento

        if not self.kb_path.exists():
            raise FileNotFoundError(
                f"No se encontró la base de conocimiento en {self.kb_path}. "
                "Asegúrate de que knowledge_base.json esté en el directorio del proyecto."
            )

        with open(self.kb_path, "r", encoding="utf-8") as f:
            self._conocimiento = json.load(f)

        return self._conocimiento

    def obtener_info_agente(self) -> dict:
        """Devuelve el nombre del agente y la info general de la empresa."""
        kb = self.cargar_conocimiento()
        return {
            "nombre_agente": kb["nombre_agente"],
            "empresa": kb["empresa"],
            "pais": kb["pais"],
            "moneda": kb["moneda"],
            "descripcion_empresa": kb["descripcion_empresa"],
            "info_general": kb["info_general"],
        }

    def obtener_categorias_resumen(self) -> list[dict]:
        """Devuelve un resumen de todas las categorías disponibles."""
        kb = self.cargar_conocimiento()
        resumen = []
        for cat in kb["categorias"]:
            resumen.append({
                "nombre": cat["nombre"],
                "tipos_producto": cat["tipos_producto"],
                "descripcion_general": cat["descripcion_general"],
            })
        return resumen

    def buscar_en_conocimiento(self, consulta: str) -> dict:
        """
        Busca en la base de conocimiento local por coincidencia de palabras clave.
        Devuelve las categorías relevantes con toda su info (usos B2B, características,
        preguntas para cotizar).
        """
        kb = self.cargar_conocimiento()
        consulta_lower = consulta.lower()
        palabras = set(consulta_lower.split())

        categorias_encontradas = []

        for cat in kb["categorias"]:
            score = 0

            # Buscar en nombre de la categoría
            if cat["nombre"].lower() in consulta_lower:
                score += 10

            # Buscar en tipos de producto
            for tipo in cat["tipos_producto"]:
                tipo_lower = tipo.lower()
                if tipo_lower in consulta_lower:
                    score += 8
                for palabra_tipo in tipo_lower.split():
                    if len(palabra_tipo) > 3 and palabra_tipo in palabras:
                        score += 3

            # Buscar en descripción general
            desc_lower = cat["descripcion_general"].lower()
            for palabra in palabras:
                if len(palabra) > 3 and palabra in desc_lower:
                    score += 1

            # Buscar en usos típicos B2B
            for uso in cat.get("usos_tipicos_b2b", []):
                uso_lower = uso.lower()
                for palabra in palabras:
                    if len(palabra) > 3 and palabra in uso_lower:
                        score += 2

            # Buscar en características
            for carac in cat.get("caracteristicas_clave", []):
                carac_lower = carac.lower()
                for palabra in palabras:
                    if len(palabra) > 3 and palabra in carac_lower:
                        score += 1

            if score > 0:
                categorias_encontradas.append((score, cat))

        # Ordenar por relevancia
        categorias_encontradas.sort(key=lambda x: x[0], reverse=True)

        resultado = {
            "consulta": consulta,
            "categorias_relevantes": [],
            "tips_venta": kb.get("tips_venta_b2b", []),
        }

        for score, cat in categorias_encontradas:
            resultado["categorias_relevantes"].append({
                "nombre": cat["nombre"],
                "tipos_producto": cat["tipos_producto"],
                "descripcion_general": cat["descripcion_general"],
                "usos_tipicos_b2b": cat.get("usos_tipicos_b2b", []),
                "caracteristicas_clave": cat.get("caracteristicas_clave", []),
                "preguntas_para_cotizar": cat.get("preguntas_para_cotizar", []),
                "relevancia": score,
            })

        if not categorias_encontradas:
            resultado["mensaje"] = (
                "No encontré una categoría específica para tu consulta. "
                "Estas son todas las categorías disponibles:"
            )
            resultado["categorias_relevantes"] = self.obtener_categorias_resumen()

        palabras_carro = {"carro", "carros", "vehiculo", "vehiculos", "vehículo", "vehículos", "auto", "autos", "automóvil", "automovil"}
        if any(p in palabras for p in palabras_carro) or any(p in consulta_lower for p in palabras_carro):
            resultado["producto_no_disponible"] = (
                "Haceb NO vende carros ni vehículos automotores. "
                "Sin embargo, Haceb SÍ vende cargadores para carros eléctricos (cargadores de pared y portátiles). "
                "Debes aclararle al cliente que no vendemos carros, pero ofrecerle y buscar de inmediato los cargadores para carros eléctricos."
            )
        else:
            for producto_no in kb.get("productos_no_disponibles", []):
                if producto_no.lower() in consulta_lower:
                    resultado["producto_no_disponible"] = (
                        f"'{producto_no}' no está disponible en el catálogo de Haceb. "
                        f"Haceb se especializa en electrodomésticos y cargadores para vehículos eléctricos."
                    )
                    break

        return resultado

    def generar_contexto_rag(self) -> str:
        """Genera el bloque de contexto RAG para inyectar en el system prompt del LLM."""
        kb = self.cargar_conocimiento()

        partes = []
        partes.append(f"## Tu identidad y rol de vendedor")
        partes.append(f"- Tu nombre es **{kb['nombre_agente']}**.")
        partes.append(f"- Eres el asesor comercial de ventas B2B de **{kb['empresa']}**.")
        partes.append(f"- Personalidad: Alegre, servicial, conciso, directo y dinámico. EVITA EL USO EXCESIVO DE PARÉNTESIS (...) en tus explicaciones.")
        partes.append(f"- {kb['descripcion_empresa']}")
        partes.append(f"- País: {kb['pais']} | Moneda: {kb['moneda']}")
        partes.append(f"- {kb['info_general']['cobertura']}")
        partes.append(f"- {kb['info_general']['garantia']}")
        partes.append(f"- {kb['info_general']['soporte']}")
        partes.append("")

        partes.append("## Catálogo de productos (conocimiento local)")
        partes.append("Esta es la información general que CONOCES sobre el catálogo. ")
        partes.append("Úsala para responder preguntas generales SIN llamar al API.")
        partes.append("")

        for cat in kb["categorias"]:
            partes.append(f"### {cat['nombre']}")
            partes.append(f"**Tipos:** {', '.join(cat['tipos_producto'])}")
            partes.append(f"**Descripción:** {cat['descripcion_general']}")

            if cat.get("caracteristicas_clave"):
                partes.append(f"**Características:** {' · '.join(cat['caracteristicas_clave'])}")

            if cat.get("usos_tipicos_b2b"):
                partes.append("**Usos B2B:**")
                for uso in cat["usos_tipicos_b2b"]:
                    partes.append(f"  - {uso}")

            if cat.get("preguntas_para_cotizar"):
                partes.append("**Preguntas clave para cotizar:**")
                for preg in cat["preguntas_para_cotizar"]:
                    partes.append(f"  - {preg}")

            partes.append("")

        partes.append("## Productos que NO vendemos")
        partes.append(", ".join(kb.get("productos_no_disponibles", [])))
        partes.append("")

        partes.append("## Tips de venta B2B")
        for tip in kb.get("tips_venta_b2b", []):
            partes.append(f"- {tip}")

        return "\n".join(partes)


# ---------------------------------------------------------------------------
# Instancia singleton / Funciones de conveniencia para compatibilidad
# ---------------------------------------------------------------------------
_default_rag_engine = RAGEngine()

def cargar_conocimiento() -> dict:
    return _default_rag_engine.cargar_conocimiento()

def obtener_info_agente() -> dict:
    return _default_rag_engine.obtener_info_agente()

def obtener_categorias_resumen() -> list[dict]:
    return _default_rag_engine.obtener_categorias_resumen()

def buscar_en_conocimiento(consulta: str) -> dict:
    return _default_rag_engine.buscar_en_conocimiento(consulta)

def generar_contexto_rag() -> str:
    return _default_rag_engine.generar_contexto_rag()
