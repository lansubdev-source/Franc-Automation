# ==============================
# Combined Dockerfile for Frontend + Backend (Franc Automation)
# ==============================

# ---------- Stage 1: Build Frontend ----------
FROM node:20-alpine AS frontend-build

# Set working directory
WORKDIR /app/frontend

# Copy frontend dependencies and install
COPY frontend/package*.json ./
RUN npm ci

# Copy full frontend source and build
COPY frontend/ ./
RUN npm run build


# ---------- Stage 2: Backend + Combined Image ----------
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install essential OS dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install backend Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend ./backend

# ✅ Copy built frontend from previous stage
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create instance folder for SQLite DB
RUN mkdir -p ./backend/instance

# ✅ Add backend folder to Python path
ENV PYTHONPATH="/app"

# Expose backend (Flask) port
EXPOSE 5000

# Environment variables
ENV FLASK_APP=backend.app
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_ENV=production

# --- Optional: Auto-initialize migrations if missing ---
RUN mkdir -p /app/backend/migrations || true

# ✅ Start Flask backend (serves API + built frontend)
CMD ["python", "-u", "backend/app.py"]
