FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/app ./app

EXPOSE 8000
ENV PORT=8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
