# backend/utils/audit.py
import logging
from flask import current_app

# configure root logger (only once)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

logger = logging.getLogger("franc-automation")


def log_info(msg, **kwargs):
    """Log to terminal and Flask app.logger if available."""
    logger.info(msg)
    try:
        current_app.logger.info(msg)
    except Exception:
        pass


def emit_event(event_name: str, payload: dict):
    """
    Emit over SocketIO if initialized; log regardless.
    Avoids 'NoneType' error when SocketIO is not ready.
    """
    try:
        from backend.extensions import socketio  # import inside function
        if socketio:
            socketio.emit(event_name, payload)
            log_info(f"[SOCKETIO] EMIT {event_name}: {payload}")
        else:
            log_info(f"[SOCKETIO] Skipped emit {event_name}: socketio not initialized")
    except Exception as e:
        log_info(f"[SOCKETIO] EMIT ERROR {event_name}: {e}")
