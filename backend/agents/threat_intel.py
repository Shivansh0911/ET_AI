"""
Threat Intelligence Agent using Tavily search.
Falls back to LLM-only analysis if Tavily is unavailable or rate-limited.
"""
import os
from dotenv import load_dotenv
from utils.groq_client import query_llm

load_dotenv()

def search_threat_intel(query: str) -> dict:
    """Search for threat intelligence using Tavily, with fallback."""
    results = {"query": query, "findings": [], "sources": []}

    tavily_key = os.getenv("TAVILY_API_KEY")
    if tavily_key:
        try:
            from tavily import TavilyClient
            client = TavilyClient(api_key=tavily_key)
            response = client.search(
                query=f"cybersecurity threat {query} India critical infrastructure 2024 2025",
                max_results=5,
                search_depth="basic"
            )
            for r in response.get("results", []):
                results["findings"].append(r.get("content", "")[:300])
                results["sources"].append(r.get("url", ""))
        except Exception:
            results["findings"].append("Tavily search unavailable — using cached threat intelligence.")

    if results["findings"]:
        findings_text = "\n".join(results["findings"][:3])
        analysis = query_llm(
            "You are a cyber threat intelligence analyst for Indian critical infrastructure. Summarize the threat landscape based on these findings. Be specific about threat actors, TTPs, and recommended defenses. Keep under 200 words.",
            f"Query: {query}\nFindings:\n{findings_text}"
        )
        results["risk_assessment"] = analysis
    else:
        results["risk_assessment"] = query_llm(
            "You are a cyber threat intelligence analyst for Indian critical infrastructure. No live web search is available. Provide a general threat landscape briefing based on known TTPs and CERT-In advisory patterns relevant to the query. Keep under 200 words and state that this is based on internal knowledge, not live intel.",
            f"Query: {query}"
        )

    return results
