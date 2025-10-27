from flask import Blueprint, jsonify
from backend.extensions import db, socketio
from backend.models import SensorData, Device
from sqlalchemy import desc
from datetime import datetime, timedelta

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api")

# --------------------------
# 📊 Get latest metrics
# --------------------------
@dashboard_bp.route("/dashboard/current", methods=["GET"])
def get_current_data():
    """Return latest sensor data entry."""
    latest = SensorData.query.order_by(desc(SensorData.timestamp)).first()
    if not latest:
        return jsonify({"error": "No data available"}), 404

    data = {
        "id": latest.id,
        "device_id": latest.device_id,
        "temperature": latest.temperature or 0,
        "humidity": latest.humidity or 0,
        "pressure": latest.pressure or 0,
        "timestamp": latest.timestamp.isoformat(),
    }
    return jsonify(data), 200


# --------------------------
# 📈 Get chart data (last N readings)
# --------------------------
@dashboard_bp.route("/dashboard/chart", methods=["GET"])
def get_chart_data():
    """Return last 50 sensor readings for chart visualization."""
    last_records = (
        SensorData.query.order_by(desc(SensorData.timestamp)).limit(50).all()
    )
    chart_data = [
        {
            "timestamp": s.timestamp.strftime("%H:%M:%S"),
            "temperature": s.temperature,
            "humidity": s.humidity,
            "pressure": s.pressure,
        }
        for s in reversed(last_records)
    ]
    return jsonify(chart_data), 200


# --------------------------
# 💻 Get device status summary
# --------------------------
@dashboard_bp.route("/dashboard/devices", methods=["GET"])
def get_device_status():
    devices = Device.query.all()
    total = len(devices)
    online = sum(1 for d in devices if d.status == "online")
    return jsonify({
        "total_devices": total,
        "online": online,
        "offline": total - online
    }), 200


# --------------------------
# 🔄 SocketIO real-time push
# --------------------------
@socketio.on("new_sensor_data")
def handle_new_sensor_data(data):
    """Emit new sensor update to connected dashboards."""
    socketio.emit("dashboard_update", data)
