"""
Conversational Security Copilot.
Chat interface for SOC analysts to query security data using natural language.
"""
from typing import List
from utils.groq_client import query_llm

def chat_with_copilot(message: str, context: List[dict], current_alerts: List[dict]) -> str:
    """Process a copilot chat message with security context."""

    alert_summary = "\n".join([
        f"- [{a['severity']}] {a['asset']}: {a['description']} (MITRE: {a.get('mitre_id', 'N/A')})"
        for a in current_alerts[:20]
    ])

    history = "\n".join([
        f"{msg['role'].upper()}: {msg['content']}"
        for msg in context[-6:]
    ])

    system_prompt = f"""You are CyberSentinel Copilot — an AI security analyst assistant deployed across Indian critical national infrastructure (AIIMS, CBSE, Power Grid, Railways, SBI, ISRO, NIC, BSNL).

CURRENT SECURITY POSTURE (live data):
{alert_summary if alert_summary else "No active alerts at this time."}

CONVERSATION HISTORY:
{history if history else "New conversation."}

CAPABILITIES:
- Analyze active threats and explain attack patterns
- Map events to MITRE ATT&CK framework
- Recommend containment and response actions per CERT-In guidelines
- Explain compound risk scenarios
- Provide threat intelligence context

RULES:
- Be concise and actionable — this is a SOC environment under pressure
- Always cite MITRE technique IDs when discussing attack patterns
- Reference CERT-In mandatory reporting timelines when relevant
- If asked about something outside your security data, say so honestly
- Never hallucinate threat data — work only with what's in the current alerts"""

    return query_llm(system_prompt, f"SOC Analyst query: {message}", temperature=0.4, max_tokens=800)
