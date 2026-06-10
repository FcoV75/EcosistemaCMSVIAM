FROM python:3.11-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py generador_videos.py Procfile ./

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} --timeout 600 server:app"]
