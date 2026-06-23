# ╔══════════════════════════════════════════════════════════════╗
# ║  DharmaAI Stress Analyzer API                               ║
# ║  Combines: Emotion Classifier (stress proxy) + Sentiment    ║
# ║  Deploy on HuggingFace Spaces (Docker SDK)                  ║
# ╚══════════════════════════════════════════════════════════════╝

import os
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from transformers import pipeline

# ─── App Setup ───
app = FastAPI(
    title="DharmaAI Stress Analyzer",
    description="Analyzes chat conversations for stress levels and emotional patterns",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Auth ───
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)


def verify_api_key(api_key: str = Security(api_key_header)):
    expected_key = os.getenv("STRESS_API_KEY")
    if not expected_key:
        return None  # Bypass if no key configured
    if api_key != expected_key:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")
    return api_key


# ─── Load Models ───
print("🔄 Loading models...")

# MODEL A: Emotion classifier (7 classes) — also used as stress proxy
# anger, disgust, fear, joy, neutral, sadness, surprise
# 1M+ downloads, actively maintained
EMOTION_MODEL = "j-hartmann/emotion-english-distilroberta-base"
print(f"   Loading emotion model: {EMOTION_MODEL}")
emotion_classifier = pipeline(
    "text-classification",
    model=EMOTION_MODEL,
    top_k=7,  # Return all 7 emotion scores
)

# MODEL B: Sentiment classifier (positive/negative/neutral)
SENTIMENT_MODEL = "distilbert/distilbert-base-uncased-finetuned-sst-2-english"
print(f"   Loading sentiment model: {SENTIMENT_MODEL}")
sentiment_classifier = pipeline(
    "text-classification",
    model=SENTIMENT_MODEL,
)

print("✅ All models loaded!")

# Stress-indicating emotions (negative emotions = stress proxy)
STRESS_EMOTIONS = {"anger", "disgust", "fear", "sadness"}
POSITIVE_EMOTIONS = {"joy", "surprise"}


# ─── Request / Response Schemas ───
class ChatMessage(BaseModel):
    role: str  # "user" or "ai"
    content: str
    timestamp: Optional[str] = None


class AnalysisRequest(BaseModel):
    messages: List[ChatMessage]
    user_name: Optional[str] = "User"


class MessageDetail(BaseModel):
    content_preview: str
    stress_label: str
    stress_score: float
    top_emotion: str
    emotions: dict


class AnalysisResponse(BaseModel):
    overall_stress_level: str  # "low", "moderate", "high", "critical"
    stress_score: float  # 0.0 - 1.0
    wellness_score: int  # 1-10 (inverse of stress)
    dominant_emotions: List[str]
    emotion_breakdown: dict
    mood_trend: str  # "improving", "stable", "declining"
    stress_trend: List[float]
    total_messages: int
    user_messages_analyzed: int
    stressed_message_count: int
    stressed_percentage: float
    key_patterns: List[str]
    recommendations: List[str]
    message_details: List[MessageDetail]
    analyzed_at: str
    model_version: str


# ─── Analysis Engine ───
def analyze_single_message(text: str) -> dict:
    """Analyze a single message for stress + emotions."""
    truncated = text[:512]

    # Emotion detection (7 classes)
    emotion_results = emotion_classifier(truncated)
    if emotion_results and isinstance(emotion_results[0], list):
        emotion_results = emotion_results[0]

    emotions = {}
    top_emotion = "neutral"
    top_score = 0.0
    stress_score = 0.0

    for e in emotion_results:
        emotions[e["label"]] = round(e["score"], 4)
        if e["score"] > top_score:
            top_score = e["score"]
            top_emotion = e["label"]
        # Sum negative emotion scores as stress proxy
        if e["label"] in STRESS_EMOTIONS:
            stress_score += e["score"]

    # Cap stress_score at 1.0
    stress_score = min(stress_score, 1.0)
    is_stressed = stress_score > 0.5

    return {
        "stress_label": "stressed" if is_stressed else "not_stressed",
        "stress_score": round(stress_score, 4),
        "top_emotion": top_emotion,
        "emotions": emotions,
    }


def detect_patterns(message_details: List[dict], all_stress_scores: List[float]) -> List[str]:
    """Detect behavioral patterns from the analysis."""
    patterns = []
    emotion_counts = {}
    for detail in message_details:
        e = detail["top_emotion"]
        emotion_counts[e] = emotion_counts.get(e, 0) + 1

    total = len(message_details) or 1

    if emotion_counts.get("sadness", 0) / total > 0.3:
        patterns.append("Frequent expressions of sadness — may indicate emotional distress or grief")
    if emotion_counts.get("fear", 0) / total > 0.25:
        patterns.append("Recurring anxiety or fear — suggests persistent worry about future events")
    if emotion_counts.get("anger", 0) / total > 0.2:
        patterns.append("Signs of frustration or anger — may indicate unresolved conflicts")
    if emotion_counts.get("disgust", 0) / total > 0.15:
        patterns.append("Expressions of disgust or aversion — may reflect dissatisfaction")

    high_stress_count = sum(1 for s in all_stress_scores if s > 0.7)
    if high_stress_count / total > 0.5:
        patterns.append("Persistently high stress levels across conversations")

    if len(all_stress_scores) >= 4:
        mid = len(all_stress_scores) // 2
        first_half = sum(all_stress_scores[:mid]) / mid
        second_half = sum(all_stress_scores[mid:]) / (len(all_stress_scores) - mid)
        if second_half < first_half - 0.15:
            patterns.append("Positive trend — stress levels are decreasing over time")
        elif second_half > first_half + 0.15:
            patterns.append("Concerning trend — stress levels are increasing over time")

    if emotion_counts.get("joy", 0) / total > 0.2:
        patterns.append("Moments of joy and positivity — a healthy sign of resilience")

    if not patterns:
        patterns.append("No strong patterns detected — continue monitoring")

    return patterns


def get_recommendations(stress_level: str, dominant_emotions: List[str], mood_trend: str) -> List[str]:
    """Generate personalized recommendations."""
    recs = []

    if stress_level in ["high", "critical"]:
        recs.extend([
            "🧘 Practice deep breathing: try the 4-7-8 technique (inhale 4s, hold 7s, exhale 8s)",
            "📝 Start a daily stress journal — writing helps process emotions",
            "🚶 Take a 15-minute walk outside, preferably in nature",
            "💤 Prioritize sleep: aim for 7-8 hours with a consistent bedtime",
            "🗣️ Consider speaking with a mental health professional for support",
        ])
    elif stress_level == "moderate":
        recs.extend([
            "🧘 Try a 10-minute guided meditation using DharmaAI",
            "📖 Read spiritual wisdom texts for perspective and calm",
            "🏃 Include light exercise (yoga, walking) in your routine",
            "🙏 Practice gratitude — list 3 things you're thankful for each day",
        ])
    else:
        recs.extend([
            "✨ You're doing well! Keep up your current wellness practices",
            "📚 Explore deeper spiritual teachings for continued growth",
            "🤝 Share your positive energy — support others in the community",
        ])

    if "sadness" in dominant_emotions:
        recs.append("💚 Connect with loved ones — social support is crucial during difficult times")
    if "fear" in dominant_emotions:
        recs.append("🌊 Practice grounding: focus on 5 things you see, 4 you touch, 3 you hear")
    if "anger" in dominant_emotions:
        recs.append("🔥 Channel energy constructively — try physical activity or creative expression")

    if mood_trend == "declining":
        recs.append("⚠️ Your stress is trending upward — consider seeking additional support")
    elif mood_trend == "improving":
        recs.append("📈 Great progress! Your stress levels are improving — keep going")

    return recs[:7]


def run_analysis(messages: List[ChatMessage], user_name: str) -> AnalysisResponse:
    """Run full analysis on chat messages."""
    user_messages = [m for m in messages if m.role == "user" and m.content.strip()]

    if not user_messages:
        raise HTTPException(status_code=400, detail="No user messages found to analyze")

    if len(user_messages) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 user messages for meaningful analysis")

    message_details = []
    all_stress_scores = []
    all_emotions_agg = {}

    for msg in user_messages:
        result = analyze_single_message(msg.content)
        all_stress_scores.append(result["stress_score"])

        for emotion, score in result["emotions"].items():
            all_emotions_agg[emotion] = all_emotions_agg.get(emotion, 0) + score

        message_details.append({**result, "content_preview": msg.content[:150]})

    # Aggregate
    avg_stress = sum(all_stress_scores) / len(all_stress_scores)
    stressed_count = sum(1 for s in all_stress_scores if s > 0.5)
    stressed_pct = (stressed_count / len(all_stress_scores)) * 100

    if avg_stress > 0.75:
        stress_level = "critical"
    elif avg_stress > 0.55:
        stress_level = "high"
    elif avg_stress > 0.35:
        stress_level = "moderate"
    else:
        stress_level = "low"

    wellness_score = max(1, min(10, round((1 - avg_stress) * 10)))

    sorted_emotions = sorted(all_emotions_agg.items(), key=lambda x: x[1], reverse=True)
    dominant = [e[0] for e in sorted_emotions[:3]]

    total_emotion_score = sum(all_emotions_agg.values()) or 1
    emotion_breakdown = {k: round((v / total_emotion_score) * 100, 1) for k, v in sorted_emotions}

    if len(all_stress_scores) >= 4:
        mid = len(all_stress_scores) // 2
        first_avg = sum(all_stress_scores[:mid]) / mid
        second_avg = sum(all_stress_scores[mid:]) / (len(all_stress_scores) - mid)
        if second_avg < first_avg - 0.1:
            mood_trend = "improving"
        elif second_avg > first_avg + 0.1:
            mood_trend = "declining"
        else:
            mood_trend = "stable"
    else:
        mood_trend = "stable"

    patterns = detect_patterns(message_details, all_stress_scores)
    recommendations = get_recommendations(stress_level, dominant, mood_trend)

    return AnalysisResponse(
        overall_stress_level=stress_level,
        stress_score=round(avg_stress, 3),
        wellness_score=wellness_score,
        dominant_emotions=dominant,
        emotion_breakdown=emotion_breakdown,
        mood_trend=mood_trend,
        stress_trend=[round(s, 3) for s in all_stress_scores],
        total_messages=len(messages),
        user_messages_analyzed=len(user_messages),
        stressed_message_count=stressed_count,
        stressed_percentage=round(stressed_pct, 1),
        key_patterns=patterns,
        recommendations=recommendations,
        message_details=[
            MessageDetail(
                content_preview=d["content_preview"],
                stress_label=d["stress_label"],
                stress_score=d["stress_score"],
                top_emotion=d["top_emotion"],
                emotions=d["emotions"],
            )
            for d in message_details
        ],
        analyzed_at=datetime.utcnow().isoformat(),
        model_version=f"emotion={EMOTION_MODEL} | sentiment={SENTIMENT_MODEL}",
    )


# ─── API Endpoints ───
@app.post("/analyze", response_model=AnalysisResponse)
def analyze_endpoint(
    request: AnalysisRequest,
    api_key: str = Security(verify_api_key),
):
    """Analyze chat messages for stress levels and emotional patterns."""
    return run_analysis(request.messages, request.user_name or "User")


@app.get("/health")
def health():
    return {"status": "healthy", "models": {"emotion": EMOTION_MODEL, "sentiment": SENTIMENT_MODEL}}


@app.get("/")
def root():
    return {
        "name": "DharmaAI Stress Analyzer",
        "version": "1.0.0",
        "endpoints": {"POST /analyze": "Analyze chat messages", "GET /health": "Health check"},
    }
