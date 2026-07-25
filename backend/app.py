"""Aplicación monolítica: frontend Astro, Jota y Mara en un solo proceso."""

from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path
from typing import Any

from dotenv import dotenv_values
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIST = PROJECT_ROOT / "dist"


def _load_backend_environment() -> None:
    """Carga la configuración del backend con fallback al .env del frontend.

    Las variables ya definidas por el proceso tienen prioridad. Después se
    toma `.env.backend` y, para cualquier clave ausente o vacía, `.env`.
    Así el monolito funciona aunque el usuario solo haya configurado el
    archivo `.env`.
    """
    backend_values = dotenv_values(PROJECT_ROOT / ".env.backend")
    frontend_values = dotenv_values(PROJECT_ROOT / ".env")
    keys = set(backend_values) | set(frontend_values)

    for key in keys:
        if not key or os.getenv(key):
            continue
        value = backend_values.get(key) or frontend_values.get(key)
        if value is not None:
            os.environ[key] = value


_load_backend_environment()

from .agents import AgenteSoporte, AgenteVentas
from .contracts import (
    ChatRequest,
    ChatResponse,
    comparison,
    now_iso,
    sales_products,
    support_blocks,
)

app = FastAPI(
    title="HACEB Asistente",
    description="Monolito con Jota para ventas y Mara para soporte técnico.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
)

sales_sessions: dict[str, AgenteVentas] = {}
support_sessions: dict[str, AgenteSoporte] = {}


def _session_id(requested: str | None) -> str:
    return requested or str(uuid.uuid4())


def _sales_agent(session_id: str) -> AgenteVentas:
    if session_id not in sales_sessions:
        sales_sessions[session_id] = AgenteVentas()
    return sales_sessions[session_id]


def _support_agent(session_id: str) -> AgenteSoporte:
    if session_id not in support_sessions:
        try:
            support_sessions[session_id] = AgenteSoporte()
        except SystemExit as error:
            raise RuntimeError(str(error)) from error
    return support_sessions[session_id]


def _prompt(request: ChatRequest) -> str:
    prompt = request.message
    if request.product_context:
        prompt += f"\n\n[Contexto de interfaz: {request.product_context}]"
    if request.attachments:
        names = [
            str(attachment.get("name"))
            for attachment in request.attachments
            if attachment.get("name")
        ]
        prompt += (
            "\n[Adjuntos informados por la interfaz: "
            f"{', '.join(names) or len(request.attachments)}]"
        )
    return prompt


@app.get("/api/health")
@app.get("/health", include_in_schema=False)
def health():
    return {
        "status": "ok",
        "service": "haceb-monolith",
        "agents": {
            "sales": "Jota",
            "support": "Mara",
        },
        "sessions": {
            "sales": len(sales_sessions),
            "support": len(support_sessions),
        },
        "frontend_available": FRONTEND_DIST.is_dir(),
    }


@app.get("/api/agents")
def agents():
    return [
        {"id": "sales", "name": "Jota", "status": "available"},
        {"id": "support", "name": "Mara", "status": "available"},
    ]


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    session_id = _session_id(request.session_id)
    response_id = str(uuid.uuid4())

    try:
        if request.agent == "sales":
            agent = _sales_agent(session_id)
            text = await asyncio.to_thread(
                agent.enviar_mensaje,
                _prompt(request),
            )
            blocks: list[dict[str, Any]] = [{
                "id": f"{response_id}-text",
                "type": "text",
                "text": text,
            }]
            products = sales_products(agent)
            if products:
                blocks.append({
                    "id": f"{response_id}-products",
                    "type": "product-list",
                    "title": "Opciones del catálogo oficial Haceb",
                    "products": products,
                })
                if len(products) > 1 and "compar" in request.message.lower():
                    blocks.append({
                        "id": f"{response_id}-comparison",
                        "type": "product-comparison",
                        "title": "Comparación de opciones Haceb",
                        "products": products,
                        "comparison": comparison(response_id, products),
                    })
        else:
            agent = _support_agent(session_id)
            text = await asyncio.to_thread(
                agent.enviar_mensaje,
                _prompt(request),
            )
            blocks = support_blocks(
                agent,
                response_id,
                text,
                request.message,
            )
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "agent-error",
                "agent": request.agent,
                "message": str(error),
            },
        ) from error

    return ChatResponse(
        id=response_id,
        agent=request.agent,
        sessionId=session_id,
        blocks=blocks,
        createdAt=now_iso(),
    )


@app.delete("/api/session/{agent}/{session_id}")
def delete_session(agent: str, session_id: str):
    if agent not in {"sales", "support"}:
        raise HTTPException(status_code=422, detail="Agente inválido")
    sessions = sales_sessions if agent == "sales" else support_sessions
    if sessions.pop(session_id, None) is None:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return {"ok": True}


if FRONTEND_DIST.is_dir():
    # Debe montarse al final: las rutas /api/* tienen prioridad.
    app.mount(
        "/",
        StaticFiles(directory=FRONTEND_DIST, html=True),
        name="frontend",
    )
