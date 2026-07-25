"""
providers/__init__.py — Proveedor LLM seleccionado vía entorno.
"""

import os

from .base import LLMProvider


def get_provider() -> LLMProvider:
    """Factory: devuelve el proveedor configurado en LLM_PROVIDER."""
    provider_name = os.getenv("LLM_PROVIDER", "gemini").lower().strip()

    if provider_name == "gemini":
        from .gemini import GeminiProvider
        return GeminiProvider()

    if provider_name == "openai":
        from .openai_compat import OpenAICompatProvider
        return OpenAICompatProvider()

    raise ValueError(
        f"Proveedor desconocido: '{provider_name}'. "
        "Valores válidos: gemini, openai"
    )
