import os
from datetime import timedelta
from pathlib import Path

# --- Base and Instance Directories ---
BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / "instance"
INSTANCE_DIR.mkdir(exist_ok=True)  # Ensure instance folder exists


class Config:
    # --- Security ---
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-secret-key")

    # --- Database ---
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{INSTANCE_DIR / 'app.db'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- JWT Authentication ---
    JWT_SECRET = os.environ.get("JWT_SECRET", "jwt-secret-change-me")
    JWT_ALGORITHM = "HS256"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.environ.get("JWT_EXP_HOURS", "12"))
    )

    # --- MQTT Defaults ---
    MQTT_BROKER_URL = os.environ.get("MQTT_BROKER_URL", "test.mosquitto.org")
    MQTT_BROKER_PORT = int(os.environ.get("MQTT_BROKER_PORT", 1883))
    MQTT_KEEPALIVE = int(os.environ.get("MQTT_KEEPALIVE", 60))
    MQTT_USERNAME = os.environ.get("MQTT_USERNAME", None)
    MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", None)
    MQTT_TLS = os.environ.get("MQTT_TLS", "false").lower() in ("1", "true", "yes")

    # --- SocketIO / CORS ---
    SOCKETIO_CORS_ALLOWED_ORIGINS = os.environ.get("SOCKETIO_CORS", "*")
