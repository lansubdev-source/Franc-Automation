# ==========================================================
# backend/routes/device_routes.py — Dynamic MQTT integration
# ==========================================================
from flask import Blueprint, request, jsonify
from datetime import datetime
from backend.extensions import db
from backend.models import Device
from backend.utils.audit import log_info, emit_event
from backend.utils.dashboard import emit_dashboard_update
from backend.mqtt_service import start_device_mqtt, reload_device, stop_device_mqtt

device_bp = Blueprint("device_bp", __name__)

# ==========================================================
# ADD NEW DEVICE
# ==========================================================
@device_bp.route("/devices", methods=["POST"])
def add_device():
    data = request.get_json(silent=True)
    if not data or not data.get("name"):
        return jsonify({"error": "Device name is required"}), 400

    name = data["name"].strip()

    # ✅ Disconnect any previously active device
    existing_devices = Device.query.all()
    for d in existing_devices:
        stop_device_mqtt(d.id)

    # ✅ Remove duplicates
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
        updated_at=datetime.utcnow(),
    )

    try:
        db.session.add(device)
        db.session.commit()
        log_info(f"✅ Device added: {device.name} (id={device.id})")

        # ✅ Start MQTT connection for the new device
        start_device_mqtt(device)

        emit_event("device_added", device.to_dict())
        emit_dashboard_update()
        return jsonify({"message": "Device added", "device": device.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        log_info(f"[ERROR] Failed to add device: {e}")
        return jsonify({"error": f"Failed to add device: {e}"}), 500


# ==========================================================
# LIST ALL DEVICES
# ==========================================================
@device_bp.route("/devices", methods=["GET"])
def list_devices():
    devices = Device.query.order_by(Device.created_at.desc()).all()
    device_list = [d.to_dict() for d in devices]

    log_info(f"📋 Devices listed: count={len(device_list)}")
    emit_event("devices_listed", {"count": len(device_list), "devices": device_list})

    return jsonify(device_list), 200


# ==========================================================
# UPDATE DEVICE
# ==========================================================
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

    try:
        db.session.commit()
        log_info(f"✏️ Device updated: id={device.id}")

        # ✅ Reload MQTT for updated device
        reload_device(device)

        emit_event("device_updated", device.to_dict())
        emit_dashboard_update()
        return jsonify({"message": "Device updated", "device": device.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        log_info(f"[ERROR] Failed to update device: {e}")
        return jsonify({"error": f"Failed to update device: {e}"}), 500


# ==========================================================
# DELETE DEVICE
# ==========================================================
@device_bp.route("/devices/<int:device_id>", methods=["DELETE"])
def delete_device(device_id):
    device = Device.query.get_or_404(device_id)

    try:
        # ✅ Stop MQTT before deletion
        stop_device_mqtt(device.id)

        db.session.delete(device)
        db.session.commit()

        log_info(f"🗑️ Device deleted: id={device_id}")
        emit_event("device_deleted", {"id": device_id})

        # ✅ If no devices left → clear dashboard
        if Device.query.count() == 0:
            emit_dashboard_update()

        return jsonify({"message": "Device deleted"}), 200

    except Exception as e:
        db.session.rollback()
        log_info(f"[ERROR] Failed to delete device: {e}")
        return jsonify({"error": f"Failed to delete device: {e}"}), 500
