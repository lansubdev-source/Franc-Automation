from flask import Blueprint, request, jsonify, current_app
from backend.extensions import db, socketio
from backend.models import Device
from datetime import datetime
from backend.utils.audit import log_info, emit_event
from subprocess import run

device_bp = Blueprint("device_bp", __name__)

# -------------------------------
# 🔹 Add new device
# -------------------------------
@device_bp.route("/devices", methods=["POST"])
def add_device():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    name = data.get("name")
    if not name:
        return jsonify({"error": "Device name is required"}), 400

    if Device.query.filter_by(name=name).first():
        return jsonify({"error": "Device already exists"}), 409

    device = Device(
        name=name,
        protocol=data.get("protocol", "mqtt"),
        host=data.get("host"),
        port=data.get("port", 1883),
        client_id=data.get("clientId"),
        username=data.get("username"),
        password=data.get("password"),
        mqtt_version=data.get("mqttVersion"),
        keep_alive=data.get("keepAlive"),
        auto_reconnect=data.get("autoReconnect"),
        reconnect_period=data.get("reconnectPeriod"),
        status="offline",
        updated_at=datetime.utcnow()
    )

    db.session.add(device)
    db.session.commit()

    # Auto-run migration after device creation
    try:
        print("[AUTO-MIGRATION] Running after device creation...")
        run(["flask", "db", "migrate", "-m", "device_added"], check=False)
        run(["flask", "db", "upgrade"], check=False)
        print("[AUTO-MIGRATION] ✅ Migration applied successfully.")
    except Exception as e:
        print(f"[AUTO-MIGRATION] ⚠️ Migration failed: {e}")

    # Log & emit
    log_info(f"Device added: {device.name} (id={device.id})")
    emit_event("device_added", device.to_dict())

    return jsonify({"message": "Device added", "device": device.to_dict()}), 201


# -------------------------------
# 🔹 List all devices
# -------------------------------
@device_bp.route("/devices", methods=["GET"])
def list_devices():
    devices = Device.query.order_by(Device.created_at.desc()).all()
    device_list = [d.to_dict() for d in devices]
    log_info(f"Devices listed: count={len(device_list)}")
    emit_event("devices_listed", {"count": len(device_list), "devices": device_list})
    return jsonify(device_list), 200


# -------------------------------
# 🔹 Update a device
# -------------------------------
@device_bp.route("/devices/<int:device_id>", methods=["PUT"])
def update_device(device_id):
    device = Device.query.get_or_404(device_id)
    data = request.get_json(silent=True) or {}

    mapping = {
        "clientId": "client_id",
        "mqttVersion": "mqtt_version",
        "keepAlive": "keep_alive",
        "autoReconnect": "auto_reconnect",
        "reconnectPeriod": "reconnect_period",
    }

    for key, value in data.items():
        field = mapping.get(key, key)
        if hasattr(device, field):
            setattr(device, field, value)

    device.updated_at = datetime.utcnow()
    db.session.commit()

    log_info(f"Device updated: id={device.id}")
    emit_event("device_updated", device.to_dict())

    return jsonify({"message": "Device updated", "device": device.to_dict()}), 200


# -------------------------------
# 🔹 Delete a device
# -------------------------------
@device_bp.route("/devices/<int:device_id>", methods=["DELETE"])
def delete_device(device_id):
    device = Device.query.get_or_404(device_id)
    db.session.delete(device)
    db.session.commit()

    log_info(f"Device deleted: id={device_id}")
    emit_event("device_deleted", {"id": device_id})

    return jsonify({"message": "Device deleted"}), 200
