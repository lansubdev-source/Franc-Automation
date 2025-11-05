# ==========================================================
# backend/extensions.py
# ==========================================================
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO

# ==========================================================
# Database and SocketIO Initialization
# ==========================================================
db = SQLAlchemy()

# ✅ Use eventlet mode since app.py runs under eventlet.wsgi.server
socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode="eventlet",
    ping_interval=25,
    ping_timeout=60,
)
