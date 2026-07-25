"""
cotizacion.py — Estado del BOM (Bill of Materials) / cotización.

Mantiene la lista de items seleccionados con cantidades, precios y
permite agregar, quitar, modificar y totalizar.
"""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ItemCotizacion:
    """Un ítem dentro de la cotización."""
    product_id: str
    nombre: str
    marca: str
    precio_unitario: float
    precio_lista: float | None  # precio original (sin descuento)
    cantidad: int
    espacio: str  # ej: "habitaciones", "cocina industrial", "sala de estar"
    nota: str = ""  # nota del agente (ej: "bajo consumo, ideal para 50 unidades")
    imagen: str | None = None

    @property
    def subtotal(self) -> float:
        return self.precio_unitario * self.cantidad

    @property
    def ahorro_unitario(self) -> float:
        if self.precio_lista and self.precio_lista > self.precio_unitario:
            return self.precio_lista - self.precio_unitario
        return 0.0

    @property
    def ahorro_total(self) -> float:
        return self.ahorro_unitario * self.cantidad


class Cotizacion:
    """
    Estado vivo de la cotización.
    El agente la modifica progresivamente y al final se exporta.
    """

    def __init__(self):
        self.items: list[ItemCotizacion] = []
        self.cliente: str = ""
        self.notas_generales: str = ""
        self.creada: datetime = datetime.now()

    # --- Mutaciones ---

    def agregar(
        self,
        product_id: str,
        nombre: str,
        marca: str,
        precio_unitario: float,
        cantidad: int,
        espacio: str,
        precio_lista: float | None = None,
        nota: str = "",
        imagen: str | None = None,
    ) -> str:
        """Agrega un ítem. Si el productId ya existe, suma la cantidad."""
        for item in self.items:
            if item.product_id == product_id and item.espacio == espacio:
                item.cantidad += cantidad
                return (
                    f"Actualizado: {item.nombre} ahora tiene {item.cantidad} "
                    f"unidades en '{espacio}'. Subtotal: ${item.subtotal:,.0f}"
                )

        nuevo = ItemCotizacion(
            product_id=product_id,
            nombre=nombre,
            marca=marca,
            precio_unitario=precio_unitario,
            precio_lista=precio_lista,
            cantidad=cantidad,
            espacio=espacio,
            nota=nota,
            imagen=imagen,
        )
        self.items.append(nuevo)
        return (
            f"Agregado: {cantidad}x {nombre} ({marca}) para '{espacio}'. "
            f"Subtotal línea: ${nuevo.subtotal:,.0f}"
        )

    def quitar(self, product_id: str, espacio: str | None = None) -> str:
        """Quita un ítem por productId (y opcionalmente espacio)."""
        antes = len(self.items)
        self.items = [
            i for i in self.items
            if not (i.product_id == product_id and (espacio is None or i.espacio == espacio))
        ]
        quitados = antes - len(self.items)
        if quitados:
            return f"Eliminado(s) {quitados} línea(s) con productId {product_id}."
        return f"No se encontró ningún ítem con productId {product_id}."

    def cambiar_cantidad(self, product_id: str, nueva_cantidad: int, espacio: str | None = None) -> str:
        """Cambia la cantidad de un ítem."""
        for item in self.items:
            if item.product_id == product_id and (espacio is None or item.espacio == espacio):
                item.cantidad = nueva_cantidad
                return (
                    f"Actualizado: {item.nombre} ahora tiene {nueva_cantidad} "
                    f"unidades. Nuevo subtotal: ${item.subtotal:,.0f}"
                )
        return f"No se encontró el productId {product_id} en la cotización."

    def limpiar(self) -> str:
        """Vacía la cotización."""
        self.items.clear()
        return "Cotización limpiada."

    # --- Consultas ---

    @property
    def total(self) -> float:
        return sum(i.subtotal for i in self.items)

    @property
    def ahorro_total(self) -> float:
        return sum(i.ahorro_total for i in self.items)

    @property
    def num_items(self) -> int:
        return len(self.items)

    @property
    def num_unidades(self) -> int:
        return sum(i.cantidad for i in self.items)

    def ver(self) -> dict:
        """Devuelve la cotización como diccionario legible para el agente."""
        lineas = []
        for i, item in enumerate(self.items, 1):
            linea = {
                "linea": i,
                "productId": item.product_id,
                "nombre": item.nombre,
                "marca": item.marca,
                "espacio": item.espacio,
                "cantidad": item.cantidad,
                "precio_unitario": item.precio_unitario,
                "subtotal": item.subtotal,
            }
            if item.ahorro_unitario > 0:
                linea["ahorro_unitario"] = item.ahorro_unitario
                linea["ahorro_linea"] = item.ahorro_total
            if item.nota:
                linea["nota"] = item.nota
            lineas.append(linea)

        return {
            "cliente": self.cliente or "(sin definir)",
            "fecha": self.creada.strftime("%Y-%m-%d %H:%M"),
            "lineas": lineas,
            "resumen": {
                "total_lineas": self.num_items,
                "total_unidades": self.num_unidades,
                "total_precio": self.total,
                "ahorro_total": self.ahorro_total,
            },
        }

    def a_markdown(self) -> str:
        """Exporta la cotización como texto Markdown (para mostrar o generar PDF)."""
        lineas = []
        lineas.append("# 🛒 Cotización / Orden de Compra")
        lineas.append("")
        if self.cliente:
            lineas.append(f"**Cliente:** {self.cliente}")
        lineas.append(f"**Fecha:** {self.creada.strftime('%d/%m/%Y %H:%M')}")
        lineas.append(f"**Tienda fuente:** Haceb / Éxito (datos en vivo)")
        lineas.append("")
        lineas.append("---")
        lineas.append("")

        if not self.items:
            lineas.append("*(Cotización vacía)*")
            return "\n".join(lineas)

        # Agrupar por espacio
        espacios: dict[str, list[ItemCotizacion]] = {}
        for item in self.items:
            espacios.setdefault(item.espacio, []).append(item)

        num = 1
        for espacio, items in espacios.items():
            lineas.append(f"## 📍 {espacio}")
            lineas.append("")
            lineas.append("| # | Producto | Marca | Cant. | Precio Unit. | Subtotal |")
            lineas.append("|---|----------|-------|------:|-------------:|---------:|")
            for item in items:
                desc_precio = f"${item.precio_unitario:,.0f}"
                if item.ahorro_unitario > 0:
                    pct = round((1 - item.precio_unitario / item.precio_lista) * 100)
                    desc_precio += f" ~~${item.precio_lista:,.0f}~~ (-{pct}%)"
                lineas.append(
                    f"| {num} | {item.nombre} | {item.marca} | "
                    f"{item.cantidad} | {desc_precio} | ${item.subtotal:,.0f} |"
                )
                num += 1
            lineas.append("")

        lineas.append("---")
        lineas.append("")
        lineas.append(f"**Total unidades:** {self.num_unidades}")
        lineas.append(f"**Total cotización:** ${self.total:,.0f}")
        if self.ahorro_total > 0:
            lineas.append(f"**Ahorro total por descuentos:** ${self.ahorro_total:,.0f}")
        lineas.append("")
        if self.notas_generales:
            lineas.append(f"> {self.notas_generales}")
            lineas.append("")
        lineas.append("---")
        lineas.append("*Cotización generada automáticamente · Precios consultados en tiempo real · Sujeta a disponibilidad.*")

        return "\n".join(lineas)
