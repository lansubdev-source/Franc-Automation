from flask import Blueprint, request, jsonify
from backend.models import Sensor, Device
from backend.extensions import db, socketio
from datetime import datetime
from dateutil.parser import isoparse
from backend.utils.dashboard import emit_dashboard_update

data_bp = Blueprint("data_bp", __name__)

MAX_LIMIT = 1000  # maximum rows returned in history

# -------------------------------
# 🔹 Get the latest sensor reading (any device)
# -------------------------------
@data_bp.route("/data/latest", methods=["GET"])
def get_latest():
    """
    Returns the most recent sensor reading across all devices.
    """
    latest_entry = Sensor.query.order_by(Sensor.timestamp.desc()).first()
    if not latest_entry:
        return jsonify({"message": "No data found"}), 404
    return jsonify(latest_entry.to_dict()), 200


# -------------------------------
# 🔹 Get historical data (filter by device, time, limit, offset)
# -------------------------------
@data_bp.route("/data/history", methods=["GET"])
def get_history():
    """
    Returns historical sensor readings.
    Optional query parameters:
        device_id: int
        since: ISO 8601 datetime string
        limit: int (max 1000)
        offset: int (default 0)
    """
    q = Sensor.query

    # Filter by device_id
    device_id = request.args.get("device_id")
    if device_id:
        try:
            q = q.filter(Sensor.device_id == int(device_id))
        except ValueError:
            return jsonify({"error": "Invalid device_id"}), 400

    # Filter by timestamp
    since = request.args.get("since")
    if since:
        try:
            since_dt = isoparse(since)
            q = q.filter(Sensor.timestamp >= since_dt)
        except Exception:
            return jsonify({"error": "Invalid 'since' timestamp format. Use ISO 8601."}), 400

    # Limit and offset
    try:
        limit = min(int(request.args.get("limit", 200)), MAX_LIMIT)
    except ValueError:
        limit = 200

    try:
        offset = int(request.args.get("offset", 0))
    except ValueError:
        offset = 0

    rows = q.order_by(Sensor.timestamp.asc()).offset(offset).limit(limit).all()
    if not rows:
        return jsonify({"message": "No data found"}), 404

    return jsonify([r.to_dict() for r in rows]), 200


# -------------------------------
# 🔹 Get latest reading for a specific device
# -------------------------------
@data_bp.route("/data/device/<int:device_id>/latest", methods=["GET"])
def get_latest_for_device(device_id):
    """
    Returns the latest sensor reading for a specific device.
    """
    row = Sensor.query.filter_by(device_id=device_id).order_by(Sensor.timestamp.desc()).first()
    if not row:
        return jsonify({"message": "No data found for this device"}), 404

    return jsonify(row.to_dict()), 200


# -------------------------------
# 🔹 Add new sensor reading (emits dashboard update)
# -------------------------------
@data_bp.route("/data", methods=["POST"])
def add_sensor_data():
    """
    Adds new sensor data and emits dashboard update to frontend.
    Expected JSON:
    {
        "device_id": int,
        "temperature": float,
        "humidity": float,
        "pressure": float
    }
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
        timestamp=datetime.utcnow()
    )

    try:
        db.session.add(sensor)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to add sensor data: {e}"}), 500

    # Emit dashboard update for real-time metrics
    emit_dashboard_update()

    return jsonify({"message": "Sensor data added", "sensor": sensor.to_dict()}), 201
