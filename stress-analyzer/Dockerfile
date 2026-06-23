FROM python:3.10-slim

WORKDIR /app

# Install Python deps (CPU-only torch is much smaller)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY app.py .

# Models will auto-download on first request (saves build time/space)
# HuggingFace caches them in /root/.cache/huggingface

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
