# ==========================================================
# backend/routes/data_routes.py — Real-Time Synced Sensor API
# ==========================================================
from flask import Blueprint, request, jsonify
from backend.models import Sensor, Device
from backend.extensions import db, socketio
from datetime import datetime
from dateutil.parser import isoparse
from backend.utils.dashboard import emit_dashboard_update
from backend.mqtt_service import emit_global_mqtt_status
from pytz import timezone

data_bp = Blueprint("data_bp", __name__)
INDIA_TZ = timezone("Asia/Kolkata")

MAX_LIMIT = 1000  # maximum rows returned in history


# ==========================================================
# 🔹 Get the latest reading (across all devices)
# ==========================================================
@data_bp.route("/data/latest", methods=["GET"])
def get_latest():
    """
    Returns the most recent sensor reading across all devices.
    """
    active_devices = Device.query.filter(Device.status == "online").count()
    if active_devices == 0:
        return jsonify({
            "message": "No active devices",
            "temperature": None,
            "humidity": None,
            "pressure": None,
            "devices_online": 0,
        }), 200

    latest_entry = Sensor.query.order_by(Sensor.timestamp.desc()).first()
    if not latest_entry:
        return jsonify({
            "message": "No sensor data found yet",
            "temperature": None,
            "humidity": None,
            "pressure": None,
            "devices_online": active_devices,
        }), 200

    data = latest_entry.to_dict()
    data["devices_online"] = active_devices
    return jsonify(data), 200


# ==========================================================
# 🔹 Get historical readings (with filters)
# ==========================================================
@data_bp.route("/data/history", methods=["GET"])
def get_history():
    """
    Returns historical sensor readings.
    Optional query params:
        device_id, since (ISO timestamp), limit (≤1000), offset
    """
    q = Sensor.query

    device_id = request.args.get("device_id")
    if device_id:
        try:
            q = q.filter(Sensor.device_id == int(device_id))
        except ValueError:
            return jsonify({"error": "Invalid device_id"}), 400

    since = request.args.get("since")
    if since:
        try:
            since_dt = isoparse(since)
            q = q.filter(Sensor.timestamp >= since_dt)
        except Exception:
            return jsonify({"error": "Invalid 'since' timestamp format. Use ISO 8601."}), 400

    try:
        limit = min(int(request.args.get("limit", 200)), MAX_LIMIT)
    except ValueError:
        limit = 200
    try:
        offset = int(request.args.get("offset", 0))
    except ValueError:
        offset = 0

    rows = q.order_by(Sensor.timestamp.asc()).offset(offset).limit(limit).all()
    return jsonify([r.to_dict() for r in rows]), 200


# ==========================================================
# 🔹 Get latest reading for a specific device
# ==========================================================
@data_bp.route("/data/device/<int:device_id>/latest", methods=["GET"])
def get_latest_for_device(device_id):
    """
    Returns the latest sensor reading for one device.
    """
    device = Device.query.get(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404

    row = Sensor.query.filter_by(device_id=device_id).order_by(Sensor.timestamp.desc()).first()
    if not row:
        return jsonify({
            "message": "No data found for this device",
            "temperature": None,
            "humidity": None,
            "pressure": None,
            "device_name": device.name,
            "status": device.status,
        }), 200

    data = row.to_dict()
    data["device_name"] = device.name
    data["status"] = device.status
    return jsonify(data), 200


# ==========================================================
# 🔹 Add new sensor reading manually (with live updates)
# ==========================================================
@data_bp.route("/data", methods=["POST"])
def add_sensor_data():
    """
    Adds new sensor data manually.
    JSON:
        { "device_id": int, "temperature": float, "humidity": float, "pressure": float }
    """
    data = request.get_json(silent=True)
    if not data or "device_id" not in data:
        return jsonify({"error": "device_id is required"}), 400

    device = Device.query.get(data["device_id"])
    if not device:
        return jsonify({"error": "Device not found"}), 404

    sensor = Sensor(
        device_id=device.id,
        temperature=data.get("temperature"),
        humidity=data.get("humidity"),
        pressure=data.get("pressure"),
        timestamp=datetime.now(INDIA_TZ),
    )

    try:
        db.session.add(sensor)
        db.session.commit()

        # ✅ Emit live update for Devices page and Dashboard
        socketio.emit("sensor_data", {
            "id": sensor.id,
            "device_id": device.id,
            "device_name": device.name,
            "temperature": sensor.temperature,
            "humidity": sensor.humidity,
            "pressure": sensor.pressure,
            "status": device.status,
            "timestamp": sensor.timestamp.isoformat(),
        })

        emit_dashboard_update()
        emit_global_mqtt_status()

        return jsonify({
            "message": "Sensor data added",
            "sensor": sensor.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to add sensor data: {e}"}), 500
