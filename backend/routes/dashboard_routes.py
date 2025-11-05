# ==========================================================
# backend/routes/dashboard_routes.py — Unified Dashboard API
# ==========================================================
from flask import Blueprint, jsonify
from backend.extensions import db, socketio
from backend.models import Sensor, Device
from sqlalchemy import desc
from datetime import datetime
from pytz import timezone
from backend.utils.dashboard import emit_dashboard_update
from backend.mqtt_service import emit_global_mqtt_status

dashboard_bp = Blueprint("dashboard_bp", __name__, url_prefix="/api")
INDIA_TZ = timezone("Asia/Kolkata")

# ==========================================================
# 📊 Get latest overall dashboard metrics
# ==========================================================
@dashboard_bp.route("/dashboard/current", methods=["GET"])
def get_current_data():
    """
    Return the latest sensor data across all devices.
    """
    latest = Sensor.query.order_by(desc(Sensor.timestamp)).first()
    if not latest:
        return jsonify({
            "temperature": None,
            "humidity": None,
            "pressure": None,
            "devices_online": 0,
            "status": "offline"
        }), 200

    devices_online = Device.query.filter_by(status="online").count()

    data = {
        "temperature": round(latest.temperature or 0, 1),
        "humidity": round(latest.humidity or 0, 1),
        "pressure": round(latest.pressure or 0, 1),
        "devices_online": devices_online,
        "status": "online" if devices_online > 0 else "offline",
        "timestamp": latest.timestamp.astimezone(INDIA_TZ).isoformat(),
    }
    return jsonify(data), 200


# ==========================================================
# 📈 Chart Data (Recent 50 readings for visualization)
# ==========================================================
@dashboard_bp.route("/dashboard/chart", methods=["GET"])
def get_chart_data():
    """
    Return the most recent 50 sensor readings (for charts).
    """
    records = Sensor.query.order_by(desc(Sensor.timestamp)).limit(50).all()
    chart_data = [
        {
            "timestamp": s.timestamp.astimezone(INDIA_TZ).strftime("%H:%M:%S"),
            "temperature": s.temperature,
            "humidity": s.humidity,
            "pressure": s.pressure,
        }
        for s in reversed(records)
    ]
    return jsonify(chart_data), 200


# ==========================================================
# 💻 Device summary for dashboard sidebar
# ==========================================================
@dashboard_bp.route("/dashboard/devices", methods=["GET"])
def get_device_summary():
    """
    Returns a summary of total, online, and offline devices.
    """
    devices = Device.query.all()
    total = len(devices)
    online = sum(1 for d in devices if d.status == "online")
    offline = total - online

    data = {
        "total_devices": total,
        "online": online,
        "offline": offline,
        "mqtt_status": "connected" if online > 0 else "disconnected",
        "timestamp": datetime.now(INDIA_TZ).isoformat(),
    }

    # ✅ Update all dashboards via sockets
    emit_dashboard_update()
    emit_global_mqtt_status()

    return jsonify(data), 200


# ==========================================================
# 🔄 Real-Time Socket Bridge
# ==========================================================
@socketio.on("new_sensor_data")
def handle_new_sensor_data(data):
    """
    When backend receives new MQTT or manual sensor data,
    broadcast to all connected dashboards.
    """
    print(f"[SOCKET] 🔄 Pushing dashboard update: {data}")
    socketio.emit("dashboard_update", data)
