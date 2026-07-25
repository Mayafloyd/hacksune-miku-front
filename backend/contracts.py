"""Contrato JSON compartido entre FastAPI y la interfaz React."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    message: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        validation_alias=AliasChoices("message", "mensaje"),
        serialization_alias="message",
    )
    session_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("sessionId", "session_id"),
        serialization_alias="sessionId",
    )
    agent: str = Field(default="sales", pattern="^(sales|support)$")
    product_context: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("productContext", "product_context"),
        serialization_alias="productContext",
    )
    attachments: list[dict[str, Any]] = Field(default_factory=list)


class ChatResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    agent: str
    session_id: str = Field(alias="sessionId")
    blocks: list[dict[str, Any]]
    created_at: str = Field(alias="createdAt")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


_PLACEHOLDER_IMAGE = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='520' "
    "height='420' viewBox='0 0 520 420'%3E%3Crect width='520' height='420' "
    "fill='%23f1eee7'/%3E%3Ctext x='260' y='215' text-anchor='middle' "
    "font-family='Arial' font-size='24' fill='%23252a2a'%3EHaceb%3C/text%3E%3C/svg%3E"
)

_CATEGORIES = {
    "nevera": ("refrigerator", "Neveras"),
    "refrigerador": ("refrigerator", "Neveras"),
    "lavadora": ("washer", "Lavadoras"),
    "estufa": ("stove", "Estufas"),
    "cocina": ("stove", "Estufas"),
    "calentador": ("water-heater", "Calentadores"),
    "aire": ("air-conditioner", "Aires acondicionados"),
    "acondicionado": ("air-conditioner", "Aires acondicionados"),
}


def _category(raw: dict[str, Any]) -> tuple[str, str]:
    categories = raw.get("categorias") or []
    haystack = " ".join(
        (
            str(raw.get("nombre") or ""),
            str(raw.get("descripcion") or ""),
            " ".join(str(item) for item in categories),
        )
    ).lower()
    for keyword, value in _CATEGORIES.items():
        if keyword in haystack:
            return value
    return "refrigerator", "Neveras"


def _slug(value: Any) -> str:
    normalized = re.sub(
        r"[^a-z0-9]+",
        "-",
        str(value or "producto").lower(),
    ).strip("-")
    return normalized or "producto"


def product_for_ui(raw: dict[str, Any]) -> dict[str, Any] | None:
    product_id = raw.get("productId") or raw.get("product_id")
    if not product_id:
        return None

    category, category_label = _category(raw)
    name = str(raw.get("nombre") or "Producto Haceb")
    price = raw.get("precio")
    list_price = raw.get("precio_lista")

    try:
        amount = float(price) if price is not None else None
    except (TypeError, ValueError):
        amount = None
    try:
        previous_amount = float(list_price) if list_price is not None else None
    except (TypeError, ValueError):
        previous_amount = None

    if amount and amount > 0:
        price_block: dict[str, Any] = {
            "status": "available",
            "amount": amount,
            "currency": "COP",
            "source": "official-api",
            "updatedAt": now_iso(),
        }
        if previous_amount and previous_amount > amount:
            price_block["previousAmount"] = previous_amount
    else:
        price_block = {
            "status": "unknown",
            "label": "Precio por confirmar",
        }

    available = raw.get("disponible")
    stock = raw.get("stock")
    if available is False:
        availability = {
            "status": "out-of-stock",
            "label": "Agotado",
            "source": "official-api",
            "updatedAt": now_iso(),
        }
    elif available is True and isinstance(stock, (int, float)) and stock <= 2:
        availability = {
            "status": "low-stock",
            "label": "Últimas unidades",
            "source": "official-api",
            "updatedAt": now_iso(),
        }
    elif available is True:
        availability = {
            "status": "in-stock",
            "label": "Disponible",
            "source": "official-api",
            "updatedAt": now_iso(),
        }
    else:
        availability = {
            "status": "unknown",
            "label": "Disponibilidad por confirmar",
        }

    image = raw.get("imagen") or _PLACEHOLDER_IMAGE
    return {
        "id": str(product_id),
        "slug": _slug(raw.get("slug") or name),
        "name": name,
        "model": str(raw.get("referencia") or raw.get("slug") or product_id),
        "category": category,
        "categoryLabel": category_label,
        "summary": str(
            raw.get("descripcion")
            or "Producto consultado en el catálogo oficial de Haceb."
        )[:280],
        "image": {
            "src": image,
            "alt": name,
            "isPlaceholder": not bool(raw.get("imagen")),
        },
        "price": price_block,
        "availability": availability,
        "features": ["Ficha técnica oficial disponible"],
        "technologies": [],
        "capacity": {
            "value": 0,
            "unit": "L",
            "label": "Capacidad por confirmar",
        },
        "dimensions": {
            "widthCm": 0,
            "heightCm": 0,
            "depthCm": 0,
        },
        "energyRating": "Eficiencia por confirmar",
        "colors": [],
        "warrantyLabel": "Garantía por confirmar",
        "source": "haceb-vtex-api",
        "sourceUrl": raw.get("url"),
    }


def sales_products(agent: Any) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    seen: set[str] = set()
    for result in agent.ultimo_resultado_herramientas:
        payload = result.get("payload") or {}
        candidates = payload.get("productos") if isinstance(payload, dict) else None
        if not isinstance(candidates, list) and result.get("name") == "obtener_detalle_producto":
            candidates = [payload]
        if not isinstance(candidates, list):
            continue
        for candidate in candidates:
            product = product_for_ui(candidate) if isinstance(candidate, dict) else None
            if product and product["id"] not in seen:
                seen.add(product["id"])
                products.append(product)
    return products


def comparison(response_id: str, products: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": f"{response_id}-comparison-data",
        "productIds": [product["id"] for product in products],
        "rows": [
            {
                "key": "model",
                "label": "Modelo",
                "values": {
                    product["id"]: product["model"]
                    for product in products
                },
            },
            {
                "key": "price",
                "label": "Precio",
                "values": {
                    product["id"]: product["price"].get(
                        "amount",
                        product["price"].get("label"),
                    )
                    for product in products
                },
            },
            {
                "key": "availability",
                "label": "Disponibilidad",
                "values": {
                    product["id"]: product["availability"]["label"]
                    for product in products
                },
            },
        ],
        "recommendedProductId": products[0]["id"],
        "recommendationReason": (
            "La recomendación usa los datos disponibles del catálogo oficial de Haceb."
        ),
    }


def support_blocks(
    agent: Any,
    response_id: str,
    text: str,
    user_message: str,
) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = [
        {
            "id": f"{response_id}-text",
            "type": "text",
            "text": text,
        }
    ]
    normalized = user_message.lower()
    risk_terms = (
        "olor a quemado",
        "humo",
        "chispa",
        "fuego",
        "fuga de gas",
        "cable pelado",
        "descarga eléctrica",
        "descarga electrica",
    )
    is_risk = any(term in normalized for term in risk_terms)

    if is_risk:
        blocks.append({
            "id": f"{response_id}-safety",
            "type": "safety-alert",
            "alert": {
                "id": f"{response_id}-safety-data",
                "severity": "critical",
                "title": "Detén el uso del equipo",
                "message": (
                    "Apágalo y desconéctalo. No lo vuelvas a encender hasta "
                    "que sea revisado por servicio técnico."
                ),
                "actionLabel": "Solicitar servicio técnico",
                "requiresProfessionalHelp": True,
            },
        })

    for result in agent.ultimo_resultado_herramientas:
        if result.get("name") != "obtener_informacion_producto":
            continue
        payload = result.get("payload")
        if not isinstance(payload, dict) or not payload.get("garantias"):
            continue
        coverage = " · ".join(str(item) for item in payload["garantias"])
        blocks.append({
            "id": f"{response_id}-warranty",
            "type": "warranty",
            "warranty": {
                "id": f"{response_id}-warranty-data",
                "productLabel": payload.get("nombre") or "Producto Haceb",
                "model": (
                    payload.get("referencia")
                    or payload.get("codigo")
                    or "Por confirmar"
                ),
                "serialMasked": "Por verificar",
                "status": "verification-required",
                "statusLabel": "Verificación requerida",
                "coverageSummary": coverage,
                "nextAction": (
                    "Confirma serial y fecha de compra con servicio Haceb."
                ),
            },
        })

    if not is_risk and re.search(
        r"servicio técnico|servicio tecnico|canal de servicio|escalar",
        text,
        flags=re.IGNORECASE,
    ):
        blocks.append({
            "id": f"{response_id}-handoff",
            "type": "human-handoff",
            "title": "Atención de servicio técnico",
            "message": "Mara recomienda continuar con una revisión profesional.",
            "status": "offered",
            "actionLabel": "Hablar con servicio técnico",
        })

    return blocks
