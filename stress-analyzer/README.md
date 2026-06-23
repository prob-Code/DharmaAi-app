---
title: DharmaAI Stress Analyzer
emoji: 🧠
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# DharmaAI Stress Analyzer

Analyzes chat conversations for **stress levels** and **emotional patterns** using:
- **Fine-tuned DistilBERT** for stress detection
- **Pre-trained DistilBERT** for emotion classification (joy, sadness, anger, fear, love, surprise)

## API Endpoints

### `POST /analyze`
Analyze chat messages for stress and emotions.

```json
{
  "messages": [
    {"role": "user", "content": "I feel so stressed about my exams"},
    {"role": "ai", "content": "Take a deep breath..."},
    {"role": "user", "content": "I can't sleep at night because of worry"}
  ],
  "user_name": "Friend"
}
```

### `GET /health`
Health check endpoint.

## Environment Variables
- `STRESS_API_KEY` — API key for authentication (optional)
- `STRESS_MODEL_ID` — HuggingFace model ID for stress detection (default: `elozano/bert-base-cased-stress-detection`)
