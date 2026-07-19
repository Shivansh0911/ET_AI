import os
import time
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client

# llama-3.1-70b-versatile was decommissioned by Groq; llama-3.3-70b-versatile is
# the current free-tier equivalent production model.
MODEL = "llama-3.3-70b-versatile"

def query_llm(system_prompt: str, user_prompt: str, temperature: float = 0.3, max_tokens: int = 1500) -> str:
    """Query Groq LLM with retry logic for rate limits."""
    try:
        client = _get_client()
    except Exception:
        return "[Analysis unavailable — GROQ_API_KEY is not configured on the server.]"

    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:
            if "rate_limit" in str(e).lower() and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            return "[Analysis temporarily unavailable — LLM rate limit reached. Raw event data is still being captured and will be analyzed when capacity is available.]"
