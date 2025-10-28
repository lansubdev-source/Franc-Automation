# ==========================================================
# backend/extensions.py
# ==========================================================
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO

# ==========================================================
# Database and SocketIO Initialization
# ==========================================================
db = SQLAlchemy()

# ✅ Use threading mode for compatibility with Flask debug + background emits
socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode="threading",
    ping_interval=25,
    ping_timeout=60
)
