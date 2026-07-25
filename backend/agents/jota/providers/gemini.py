"""
providers/gemini.py — Implementación Gemini (google-genai SDK).

Adapta la lógica actual de agent.py al patrón de proveedor.
"""

from __future__ import annotations

import os
import time
import uuid

from google import genai
from google.genai import types

from .base import LLMProvider, LLMResponse, ToolCall, ToolResult


# ---------------------------------------------------------------------------
# Modelos fallback (solo para Gemini)
# ---------------------------------------------------------------------------
MODELOS_FALLBACK = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
]


class GeminiProvider(LLMProvider):
    """Proveedor Gemini con fallback entre modelos."""

    def __init__(self) -> None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY no está configurada en .env")
        self.client = genai.Client(api_key=api_key)
        self._modelo_activo: str | None = None

    # ------------------------------------------------------------------
    # build tools (público, para que agent.py lo use)
    # ------------------------------------------------------------------
    @staticmethod
    def build_tools(tool_declarations: list[dict]) -> list[types.Tool]:
        """Convierte TOOL_DECLARATIONS a tipos de la SDK de Gemini."""
        function_declarations = []
        for decl in tool_declarations:
            fd = types.FunctionDeclaration(
                name=decl["name"],
                description=decl["description"],
                parameters=decl.get("parameters"),
            )
            function_declarations.append(fd)
        return [types.Tool(function_declarations=function_declarations)]

    # ------------------------------------------------------------------
    # build history (público, para que agent.py maneje el historial)
    # ------------------------------------------------------------------
    @staticmethod
    def build_history(normalized: list[dict]) -> list[types.Content]:
        """Convierte historial normalizado a Content de Gemini."""
        contents: list[types.Content] = []
        for msg in normalized:
            role = msg["role"]
            if role == "tool_response":
                parts = [
                    types.Part.from_function_response(
                        name=r["name"],
                        response={"result": r["content"]},
                    )
                    for r in msg["tool_results"]
                ]
                contents.append(types.Content(role="user", parts=parts))
            elif role == "model":
                if "parts" in msg:
                    contents.append(types.Content(role="model", parts=msg["parts"]))
                elif "text" in msg:
                    contents.append(
                        types.Content(
                            role="model",
                            parts=[types.Part.from_text(text=msg["text"])],
                        )
                    )
            elif role == "user":
                contents.append(
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=msg["text"])],
                    )
                )
        return contents

    # ------------------------------------------------------------------
    # generate_content
    # ------------------------------------------------------------------
    def generate_content(
        self,
        messages: list[dict],
        system_prompt: str,
        tools: list[dict],
        temperature: float = 0.7,
    ) -> LLMResponse:
        sdk_tools = self.build_tools(tools)
        history = self.build_history(messages)

        response, error = self._call_with_retry(history, system_prompt, sdk_tools, temperature)
        if error:
            return LLMResponse(error=error)

        if not response.candidates or not response.candidates[0].content.parts:
            return LLMResponse(text="(El agente no genero respuesta. Intenta reformular tu mensaje.)")

        parts = response.candidates[0].content.parts

        # Extraer texto
        text_parts = [p.text for p in parts if p.text]
        text = "\n".join(text_parts) if text_parts else None

        # Extraer function calls
        tool_calls: list[ToolCall] = []
        for p in parts:
            if p.function_call:
                fc = p.function_call
                args = dict(fc.args) if fc.args else {}
                tool_calls.append(
                    ToolCall(
                        id=uuid.uuid4().hex[:12],
                        name=fc.name,
                        arguments=args,
                    )
                )

        # Guardar parts raw para el historial interno del proveedor
        self._last_parts = parts

        return LLMResponse(text=text, tool_calls=tool_calls)

    # ------------------------------------------------------------------
    # format_tool_results
    # ------------------------------------------------------------------
    def format_tool_results(self, results: list[ToolResult]) -> dict:
        """Devuelve dict que agent.py puede agregar al historial normalizado."""
        return {
            "role": "tool_response",
            "tool_results": [
                {"name": r.name, "content": r.content}
                for r in results
            ],
        }

    # ------------------------------------------------------------------
    # Extraer parts del último response (para historial)
    # ------------------------------------------------------------------
    def pop_last_parts(self) -> list | None:
        """Devuelve y limpia los parts del último response."""
        parts = getattr(self, "_last_parts", None)
        self._last_parts = None
        return parts

    # ------------------------------------------------------------------
    # Retry con fallback entre modelos
    # ------------------------------------------------------------------
    def _call_with_retry(
        self,
        history: list[types.Content],
        system_prompt: str,
        tools: list[types.Tool],
        temperature: float,
    ):
        modelos = list(MODELOS_FALLBACK)
        if self._modelo_activo and self._modelo_activo in modelos:
            modelos.remove(self._modelo_activo)
            modelos.insert(0, self._modelo_activo)

        for modelo in modelos:
            for intento in range(2):
                try:
                    response = self.client.models.generate_content(
                        model=modelo,
                        contents=history,
                        config=types.GenerateContentConfig(
                            system_instruction=system_prompt,
                            tools=tools,
                            temperature=temperature,
                        ),
                    )
                    if self._modelo_activo != modelo:
                        print(f"  [i] Modelo conectado: {modelo}")
                        self._modelo_activo = modelo
                    return response, None

                except Exception as e:
                    error_str = str(e)
                    es_transitorio = any(
                        x in error_str
                        for x in ["429", "503", "RESOURCE_EXHAUSTED", "UNAVAILABLE"]
                    )
                    if es_transitorio:
                        if intento == 0:
                            print(f"  [!] {modelo}: no disponible. Reintentando en 8s...")
                            time.sleep(8)
                        else:
                            print(f"  [!] {modelo}: agotado. Probando siguiente modelo...")
                            break
                    else:
                        return None, f"Error al comunicarse con Gemini: {e}"

        return None, "Todos los modelos estan saturados. Espera 1-2 minutos e intenta de nuevo."
