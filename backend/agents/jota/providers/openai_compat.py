"""
providers/openai_compat.py — Proveedor OpenAI-compatible (OpenAI, DeepSeek, Groq, etc.).

Usa la SDK `openai` y soporta base_url para endpoints alternativos.
"""

from __future__ import annotations

import json
import os
import uuid

from openai import OpenAI
from openai.types.chat import (
    ChatCompletionMessage,
    ChatCompletionToolParam,
)

from .base import LLMProvider, LLMResponse, ToolCall, ToolResult


# ---------------------------------------------------------------------------
# Conversión de esquemas de parámetros
# ---------------------------------------------------------------------------
def _schema_for_openai(tool_declarations: list[dict]) -> list[ChatCompletionToolParam]:
    """Convierte TOOL_DECLARATIONS a formato OpenAI function calling."""
    tools: list[ChatCompletionToolParam] = []
    for decl in tool_declarations:
        params = decl.get("parameters", {})
        tools.append(
            ChatCompletionToolParam(
                type="function",
                function={
                    "name": decl["name"],
                    "description": decl["description"],
                    "parameters": params,
                },
            )
        )
    return tools


# ---------------------------------------------------------------------------
# Historial OpenAI
# ---------------------------------------------------------------------------
def _history_to_openai(normalized: list[dict]) -> list[dict]:
    """Convierte historial normalizado a formato messages de OpenAI."""
    messages: list[dict] = []
    for msg in normalized:
        role = msg["role"]

        if role == "user":
            messages.append({"role": "user", "content": msg["text"]})

        elif role == "model":
            # Una respuesta que solicita herramientas debe conservar el
            # contrato completo de OpenAI: el mensaje assistant incluye los
            # tool_calls y cada resultado posterior referencia su id.
            assistant_message: dict = {
                "role": "assistant",
                "content": msg.get("text") or None,
            }
            if msg.get("tool_calls"):
                assistant_message["tool_calls"] = [
                    {
                        "id": call["id"],
                        "type": "function",
                        "function": {
                            "name": call["name"],
                            "arguments": json.dumps(
                                call.get("arguments", {}),
                                ensure_ascii=False,
                            ),
                        },
                    }
                    for call in msg["tool_calls"]
                ]
            messages.append(assistant_message)

        elif role == "tool_response":
            for r in msg["tool_results"]:
                messages.append({
                    "role": "tool",
                    "tool_call_id": r.get("tool_call_id", ""),
                    "content": r["content"],
                })

    return messages


class OpenAICompatProvider(LLMProvider):
    """
    Proveedor compatible con OpenAI (DeepSeek, Groq, OpenAI, etc.).

    Variables de entorno:
      - OPENAI_API_KEY:   API key obligatoria
      - OPENAI_BASE_URL:  URL base (opcional, para DeepSeek/Groq)
      - OPENAI_MODEL:     Modelo a usar (opcional, default: gpt-4o)
    """

    def __init__(self) -> None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY no está configurada en .env")

        base_url = os.getenv("OPENAI_BASE_URL")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o")

        client_kwargs: dict = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url

        self.client = OpenAI(**client_kwargs)

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
        openai_messages: list[dict] = [
            {"role": "system", "content": system_prompt}
        ]
        openai_messages.extend(_history_to_openai(messages))

        openai_tools = _schema_for_openai(tools)

        try:
            kwargs: dict = {
                "model": self.model,
                "messages": openai_messages,
                "temperature": temperature,
            }
            if openai_tools:
                kwargs["tools"] = openai_tools

            response = self.client.chat.completions.create(**kwargs)
        except Exception as e:
            return LLMResponse(error=f"Error al comunicarse con OpenAI-compat: {e}")

        choice = response.choices[0]
        msg: ChatCompletionMessage = choice.message

        # Extraer texto
        text = msg.content if msg.content else None

        # Extraer tool calls
        tool_calls: list[ToolCall] = []
        if msg.tool_calls:
            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except (json.JSONDecodeError, TypeError):
                    args = {}
                tool_calls.append(
                    ToolCall(
                        id=tc.id,
                        name=tc.function.name,
                        arguments=args,
                    )
                )

        return LLMResponse(text=text, tool_calls=tool_calls)

    # ------------------------------------------------------------------
    # format_tool_results
    # ------------------------------------------------------------------
    def format_tool_results(self, results: list[ToolResult]) -> dict:
        """Devuelve dict para historial normalizado (agent.py lo procesa)."""
        return {
            "role": "tool_response",
            "tool_results": [
                {
                    "tool_call_id": r.tool_call_id,
                    "name": r.name,
                    "content": r.content,
                }
                for r in results
            ],
        }
