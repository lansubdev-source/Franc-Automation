from flask import Blueprint, request, jsonify
from backend.extensions import db, socketio
from backend.models import Sensor, Device
from backend.utils.audit import log_info
from datetime import datetime

sensor_bp = Blueprint("sensors", __name__, url_prefix="/api")


# ==========================================================
# 📘 Get all sensors
# ==========================================================
@sensor_bp.route("/sensors", methods=["GET"])
def get_sensors():
    sensors = Sensor.query.all()
    result = []
    for s in sensors:
        device = Device.query.get(s.device_id)
        result.append({
            "id": s.id,
            "name": s.name,
            "friendly_name": s.friendly_name,
            "device_id": s.device_id,
            "device_name": device.name if device else None
        })

    log_info(f"📡 Retrieved {len(result)} sensors from database")
    return jsonify(result), 200


# ==========================================================
# 📗 Add new sensor
# ==========================================================
@sensor_bp.route("/sensors", methods=["POST"])
def create_sensor():
    data = request.get_json() or {}

    required_fields = ["name", "device_id"]
    if not all(field in data and data[field] for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        device_id = int(data["device_id"])
    except ValueError:
        return jsonify({"error": "Invalid device_id"}), 400

    device = Device.query.get(device_id)
    if not device:
        return jsonify({"error": "Invalid device_id"}), 400

    new_sensor = Sensor(
        name=data["name"],
        friendly_name=data.get("friendly_name"),
        device_id=device_id,
        created_at=datetime.utcnow()
    )

    db.session.add(new_sensor)
    db.session.commit()

    sensor_data = {
        "id": new_sensor.id,
        "name": new_sensor.name,
        "friendly_name": new_sensor.friendly_name,
        "device_id": new_sensor.device_id,
        "device_name": device.name
    }

    socketio.emit("sensor_added", sensor_data)
    log_info(f"✅ New sensor added: {sensor_data}")
    return jsonify(sensor_data), 201


# ==========================================================
# ✏️ Update sensor
# ==========================================================
@sensor_bp.route("/sensors/<int:sensor_id>", methods=["PUT"])
def update_sensor(sensor_id):
    sensor = Sensor.query.get(sensor_id)
    if not sensor:
        return jsonify({"error": "Sensor not found"}), 404

    data = request.get_json() or {}

    if "name" in data:
        sensor.name = data["name"]
    if "friendly_name" in data:
        sensor.friendly_name = data["friendly_name"]
    if "device_id" in data:
        try:
            device_id = int(data["device_id"])
        except ValueError:
            return jsonify({"error": "Invalid device_id"}), 400
        device = Device.query.get(device_id)
        if not device:
            return jsonify({"error": "Invalid device_id"}), 400
        sensor.device_id = device_id

    db.session.commit()

    updated_data = {
        "id": sensor.id,
        "name": sensor.name,
        "friendly_name": sensor.friendly_name,
        "device_id": sensor.device_id,
        "device_name": Device.query.get(sensor.device_id).name if sensor.device_id else None
    }

    socketio.emit("sensor_updated", updated_data)
    log_info(f"✏️ Sensor updated: {updated_data}")
    return jsonify(updated_data), 200


# ==========================================================
# 🗑️ Delete sensor
# ==========================================================
@sensor_bp.route("/sensors/<int:sensor_id>", methods=["DELETE"])
def delete_sensor(sensor_id):
    sensor = Sensor.query.get(sensor_id)
    if not sensor:
        return jsonify({"error": "Sensor not found"}), 404

    db.session.delete(sensor)
    db.session.commit()

    socketio.emit("sensor_deleted", {"id": sensor_id})
    log_info(f"🗑️ Sensor deleted: ID {sensor_id}")
    return jsonify({"message": "Sensor deleted successfully"}), 200


# ==========================================================
# ⚙️ Get all devices (for dropdown)
# ==========================================================
@sensor_bp.route("/devices", methods=["GET"])
def get_devices():
    devices = Device.query.all()
    result = [{"id": d.id, "name": d.name} for d in devices]  # only id and name

    log_info(f"📡 Retrieved {len(result)} devices")
    return jsonify(result), 200
