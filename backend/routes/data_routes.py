# ==========================================================
# backend/routes/data_routes.py — Fixed version (no tzinfo error)
# ==========================================================
from flask import Blueprint, jsonify, request
from backend.extensions import db
from backend.models import Sensor, Device
from backend.utils.dashboard import emit_dashboard_update
from backend.mqtt_service import emit_global_mqtt_status
from datetime import datetime, timedelta
from pytz import timezone

data_bp = Blueprint("data_bp", __name__, url_prefix="/api")
INDIA_TZ = timezone("Asia/Kolkata")


# ----------------------------------------------------------
# Helper to safely localize datetime
# ----------------------------------------------------------
def _aware(dt):
    """Return a timezone-aware datetime (for Python values, not SQLAlchemy columns)."""
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            return INDIA_TZ.localize(dt)
        return dt.astimezone(INDIA_TZ)
    return dt


# ----------------------------------------------------------
# 📊 Get latest data (used by Live Data Page)
# ----------------------------------------------------------
@data_bp.route("/data/latest", methods=["GET"])
def get_latest():
    now = _aware(datetime.now())
    cutoff = now - timedelta(minutes=5)

    # ✅ Fetch latest record safely (no tzinfo checks on column)
    latest = (
        Sensor.query.order_by(Sensor.timestamp.desc())
        .filter(Sensor.timestamp >= cutoff)
        .first()
    )

    if not latest:
        return jsonify({
            "device_name": "No Device",
            "temperature": None,
            "humidity": None,
            "pressure": None,
            "status": "offline",
            "timestamp": None,
            "devices_online": 0,
        }), 200

    device = Device.query.get(latest.device_id)
    online_devices = Device.query.filter_by(is_connected=True).count()

    data = {
        "device_name": device.name if device else "Unknown",
        "temperature": latest.temperature,
        "humidity": latest.humidity,
        "pressure": latest.pressure,
        "status": "online" if device and device.is_connected else "offline",
        "timestamp": latest.timestamp.isoformat(timespec="seconds"),
        "devices_online": online_devices,
    }

    return jsonify(data), 200


# ----------------------------------------------------------
# 📈 Get all recent data (dashboard use)
# ----------------------------------------------------------
@data_bp.route("/data/recent", methods=["GET"])
def get_recent():
    now = _aware(datetime.now())
    cutoff = now - timedelta(minutes=10)
    sensors = (
        Sensor.query.filter(Sensor.timestamp >= cutoff)
        .order_by(Sensor.timestamp.desc())
        .limit(50)
        .all()
    )

    return jsonify([
        {
            "device_name": Device.query.get(s.device_id).name if s.device_id else "Unknown",
            "temperature": s.temperature,
            "humidity": s.humidity,
            "pressure": s.pressure,
            "timestamp": s.timestamp.isoformat(timespec="seconds"),
        }
        for s in sensors
    ]), 200


# ----------------------------------------------------------
# 📢 Force dashboard update (for debugging)
# ----------------------------------------------------------
@data_bp.route("/data/emit", methods=["POST"])
def emit_data_update():
    emit_dashboard_update()
    emit_global_mqtt_status()
    return jsonify({"message": "Dashboard update emitted"}), 200

# ==========================================================
# New Route: Get all sensor data in JSON format
# ==========================================================
from flask import Blueprint, jsonify
from backend.models import Sensor
from backend.extensions import db

data_bp = Blueprint("data_bp", __name__)

@data_bp.route("/api/data/all", methods=["GET"])
def get_all_sensor_data():
    sensors = Sensor.query.order_by(Sensor.id.desc()).limit(100).all()  # limit to 100 for performance
    return jsonify([s.to_dict() for s in sensors])

# ==========================================================
# New Route: Get all sensor data in JSON format
# ==========================================================
@data_bp.route("/api/data/history", methods=["GET"])
def get_history():
    """Return last 7 days of sensor data grouped by date"""
    now = datetime.utcnow()
    start = now - timedelta(days=7)

    sensors = (
        Sensor.query.filter(Sensor.timestamp >= start)
        .order_by(Sensor.timestamp.desc())
        .all()
    )

    grouped = {}
    for s in sensors:
        date_key = s.timestamp.strftime("%Y-%m-%d")
        grouped.setdefault(date_key, []).append(s.to_dict())

    return jsonify(grouped)