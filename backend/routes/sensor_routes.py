from flask import Blueprint, request, jsonify
from backend.extensions import db, socketio
from backend.models import Sensor, Device  # ✅ fixed model name

sensor_bp = Blueprint("sensors", __name__, url_prefix="/api")

# --------------------------
# 📘 Get all sensor data
# --------------------------
@sensor_bp.route("/sensors", methods=["GET"])
def get_sensors():
    sensors = Sensor.query.all()
    result = []
    for s in sensors:
        device = Device.query.get(s.device_id)
        result.append({
            "id": s.id,
            "device_id": s.device_id,
            "device_name": device.name if device else None,
            "topic": s.topic,
            "payload": s.payload,
            "temperature": s.temperature,
            "humidity": s.humidity,
            "pressure": s.pressure,
            "timestamp": s.timestamp.isoformat() if s.timestamp else None
        })
    return jsonify(result), 200


# --------------------------
# 📗 Add new sensor data
# --------------------------
@sensor_bp.route("/sensors", methods=["POST"])
def create_sensor():
    data = request.get_json()
    required = ["device_id"]

    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400

    new_sensor = Sensor(
        device_id=data["device_id"],
        topic=data.get("topic"),
        payload=data.get("payload"),
        temperature=data.get("temperature"),
        humidity=data.get("humidity"),
        pressure=data.get("pressure")
    )

    db.session.add(new_sensor)
    db.session.commit()

    socketio.emit("sensor_added", {"id": new_sensor.id, "device_id": new_sensor.device_id})
    return jsonify({"message": "Sensor data added successfully", "id": new_sensor.id}), 201


# --------------------------
# 📙 Update a sensor record
# --------------------------
@sensor_bp.route("/sensors/<int:sensor_id>", methods=["PUT"])
def update_sensor(sensor_id):
    data = request.get_json()
    sensor = Sensor.query.get(sensor_id)

    if not sensor:
        return jsonify({"error": "Sensor data not found"}), 404

    sensor.topic = data.get("topic", sensor.topic)
    sensor.payload = data.get("payload", sensor.payload)
    sensor.temperature = data.get("temperature", sensor.temperature)
    sensor.humidity = data.get("humidity", sensor.humidity)
    sensor.pressure = data.get("pressure", sensor.pressure)

    db.session.commit()
    socketio.emit("sensor_updated", {"id": sensor.id})
    return jsonify({"message": "Sensor data updated successfully"}), 200


# --------------------------
# 📕 Delete a sensor record
# --------------------------
@sensor_bp.route("/sensors/<int:sensor_id>", methods=["DELETE"])
def delete_sensor(sensor_id):
    sensor = Sensor.query.get(sensor_id)

    if not sensor:
        return jsonify({"error": "Sensor data not found"}), 404

    db.session.delete(sensor)
    db.session.commit()

    socketio.emit("sensor_deleted", {"id": sensor.id})
    return jsonify({"message": "Sensor data deleted successfully"}), 200
