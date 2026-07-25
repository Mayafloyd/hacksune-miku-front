"""
providers/base.py — Interfaz abstracta para proveedores LLM.

Cualquier proveedor debe devolver un LLMResponse normalizado.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Modelo de respuesta normalizado
# ---------------------------------------------------------------------------
@dataclass
class ToolCall:
    """Llamada a función detectada en la respuesta del LLM."""
    id: str
    name: str
    arguments: dict

    def to_preview(self) -> str:
        args_str = json.dumps(self.arguments, ensure_ascii=False)
        if len(args_str) > 100:
            args_str = args_str[:100] + "..."
        return args_str


@dataclass
class ToolResult:
    """Resultado de ejecutar una herramienta, listo para enviar al LLM."""
    tool_call_id: str
    name: str
    content: str


@dataclass
class LLMResponse:
    """Respuesta normalizada de cualquier proveedor LLM."""
    text: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)
    error: str | None = None

    @property
    def has_tool_calls(self) -> bool:
        return len(self.tool_calls) > 0

    @property
    def is_error(self) -> bool:
        return self.error is not None


# ---------------------------------------------------------------------------
# Interfaz abstracta
# ---------------------------------------------------------------------------
class LLMProvider(ABC):
    """
    Proveedor LLM abstracto.

    Implementaciones:
      - GeminiProvider  (providers/gemini.py)
      - OpenAICompatProvider (providers/openai_compat.py)

    El agente solo interactúa con esta interfaz; el loop de function calling
    se mantiene agnóstico al proveedor.
    """

    @abstractmethod
    def generate_content(
        self,
        messages: list[dict],
        system_prompt: str,
        tools: list[dict],
        temperature: float = 0.7,
    ) -> LLMResponse:
        """
        Envía contenido al LLM y devuelve una respuesta normalizada.

        Args:
            messages: Historial de mensajes en formato normalizado.
                      Cada dict tiene {role, content} para texto,
                      o {role, tool_call_id, tool_results} para respuestas de herramienta.
            system_prompt: Prompt del sistema / instrucciones.
            tools: Lista de declaraciones de herramientas (mismo formato que TOOL_DECLARATIONS).
            temperature: Temperatura de muestreo.

        Returns:
            LLMResponse con texto y/o tool_calls.
        """
        ...

    @abstractmethod
    def format_tool_results(self, results: list[ToolResult]) -> dict:
        """
        Convierte resultados de herramientas ejecutadas en un mensaje
        que el LLM puede procesar para continuar el loop.

        Args:
            results: Lista de ToolResult con cada resultado.

        Returns:
            Dict que puede agregarse al historial de mensajes.
        """
        ...
