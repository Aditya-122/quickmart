import asyncio
import json
import os
from typing import Any

import httpx
from openai import AsyncOpenAI

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
LLM_TIMEOUT_SECONDS = 10
LLM_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

SYSTEM_PROMPT = """You are a filter extraction engine for a grocery quick-commerce app.
Given a natural language query, extract structured search filters.
Always return valid JSON only. No explanation.

Output schema:
{
  "search_text": "string or null",
  "filters": {
    "category": "string or null",
    "brand": "string or null",
    "max_price": number or null,
    "min_price": number or null,
    "min_rating": number or null,
    "in_stock": boolean or null
  }
}

Available categories: Dairy, Snacks, Beverages, Fruits & Vegetables, Personal Care, Household

Rules:
- If the user mentions a brand, set brand accordingly (e.g. "amul" → "Amul")
- If the user mentions a category, match it exactly from the available categories list
- Price hints like "under ₹100", "less than 100", "below 100 rupees" → max_price
- Price hints like "above ₹200", "more than 200" → min_price
- "in stock", "available" → in_stock: true
- "out of stock" → in_stock: false
- Rating hints like "rating above 4", "highly rated" → min_rating
- If no clear search text (only filters mentioned), set search_text to null
- Return only the JSON object, nothing else"""


def _make_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=OPENAI_API_KEY,
        timeout=httpx.Timeout(LLM_TIMEOUT_SECONDS),
    )


def _parse_llm_response(content: str) -> dict[str, Any]:
    content = content.strip()
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(
            line for line in lines if not line.startswith("```")
        ).strip()
    return json.loads(content)


async def extract_filters_from_nl(query: str) -> dict[str, Any]:
    """
    Translates a natural language query into structured search filters using LLM.
    Falls back to returning the raw query as search_text on any failure.
    """
    if not OPENAI_API_KEY:
        return {"search_text": query, "filters": {}, "fallback": True, "reason": "No OpenAI API key configured"}

    client = _make_openai_client()

    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": query},
                ],
                temperature=0,
                max_tokens=256,
                response_format={"type": "json_object"},
            ),
            timeout=LLM_TIMEOUT_SECONDS,
        )

        content = response.choices[0].message.content or ""
        parsed = _parse_llm_response(content)

        # Normalise — ensure keys exist
        parsed.setdefault("search_text", query)
        parsed.setdefault("filters", {})
        parsed["fallback"] = False
        return parsed

    except asyncio.TimeoutError:
        return {
            "search_text": query,
            "filters": {},
            "fallback": True,
            "reason": "LLM request timed out after 10 seconds",
        }
    except json.JSONDecodeError as exc:
        return {
            "search_text": query,
            "filters": {},
            "fallback": True,
            "reason": f"LLM returned invalid JSON: {exc}",
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "search_text": query,
            "filters": {},
            "fallback": True,
            "reason": str(exc),
        }
