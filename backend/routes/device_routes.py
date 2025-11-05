# ==========================================================
# backend/routes/device_routes.py — Device API (Single Active Device)
# ==========================================================

from flask import Blueprint, request, jsonify
from datetime import datetime
from pytz import timezone
from backend.extensions import db, socketio
from backend.models import Device
from backend.utils.audit import log_info, emit_event
from backend.utils.dashboard import emit_dashboard_update
from backend.mqtt_service import (
    start_mqtt_client,
    stop_mqtt_client,
    start_simulator,
    stop_simulator,
    emit_global_mqtt_status,
    simulators,
    mqtt_clients,
    manual_disconnects,
    # ensure we have deletion helper
    handle_device_deletion,
)

device_bp = Blueprint("device_bp", __name__)
INDIA_TZ = timezone("Asia/Kolkata")


@device_bp.route("/devices", methods=["POST"])
def add_device():
    data = request.get_json(silent=True)
    if not data or not data.get("name"):
        return jsonify({"error": "Device name is required"}), 400

    name = data["name"].strip()
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
        enable_tls=data.get("enableTLS", False),
        status="offline",
        is_connected=False,
        updated_at=datetime.now(INDIA_TZ),
    )

    try:
        db.session.add(device)
        db.session.commit()

        socketio.emit("device_status", {
            "device_id": device.id,
            "device_name": device.name,
            "status": device.status,
            "last_seen": device.updated_at.isoformat(),
        })
        emit_event("device_added", device.to_dict())
        emit_dashboard_update()
        emit_global_mqtt_status()
        log_info(f"✅ Device added: {device.name}")

        return jsonify({"message": "Device added successfully", "device": device.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        log_info(f"[ERROR] Failed to add device: {e}")
        return jsonify({"error": f"Failed to add device: {e}"}), 500


@device_bp.route("/devices", methods=["GET"])
def list_devices():
    devices = Device.query.order_by(Device.created_at.desc()).all()
    device_list = [d.to_dict() for d in devices]
    log_info(f"📋 Devices listed: count={len(device_list)}")
    emit_event("devices_listed", {"count": len(device_list), "devices": device_list})
    return jsonify(device_list), 200


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

    device.updated_at = datetime.now(INDIA_TZ)

    try:
        db.session.commit()
        log_info(f"✏️ Device updated: id={device.id}")
        # Try reloading by stopping existing client and letting user reconnect manually
        try:
            stop_mqtt_client(device)
        except Exception:
            pass

        emit_event("device_updated", device.to_dict())
        emit_dashboard_update()
        return jsonify({"message": "Device updated", "device": device.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        log_info(f"[ERROR] Failed to update device: {e}")
        return jsonify({"error": f"Failed to update device: {e}"}), 500


@device_bp.route("/devices/<int:device_id>/connect", methods=["POST"])
def connect_device(device_id):
    device = Device.query.get_or_404(device_id)
    try:
        # ensure manual disconnect set cleared for this device
        if device.id in manual_disconnects:
            manual_disconnects.discard(device.id)

        # Stop any other active device first (stop_mqtt_client will clear state)
        # start_mqtt_client returns False if another device active
        # We proactively stop the other device to avoid the "another device active" race.
        # Find currently active client id via mqtt_clients keys if present
        for did in list(mqtt_clients.keys()):
            if did != device.id:
                try:
                    other = Device.query.get(did)
                    if other:
                        stop_mqtt_client(other, manual=False)
                        log_info(f"🔌 Auto-stopped other device before connect: {other.name}")
                except Exception:
                    pass

        started = start_mqtt_client(device)
        if not started:
            return jsonify({"error": "Could not connect device (another device active or manual block)"}), 409

        device.status = "online"
        device.is_connected = True
        device.updated_at = datetime.now(INDIA_TZ)
        db.session.commit()

        socketio.emit("device_status", {
            "device_id": device.id,
            "device_name": device.name,
            "status": "online",
            "last_seen": device.updated_at.isoformat(),
        })

        emit_dashboard_update()
        emit_global_mqtt_status()
        log_info(f"🔌 Device connected: {device.name}")
        return jsonify({"message": f"Device '{device.name}' connected successfully"}), 200

    except Exception as e:
        db.session.rollback()
        log_info(f"[ERROR] Failed to connect device: {e}")
        return jsonify({"error": f"Failed to connect device: {e}"}), 500


@device_bp.route("/devices/<int:device_id>/disconnect", methods=["POST"])
def disconnect_device(device_id):
    device = Device.query.get_or_404(device_id)
    try:
        # Add to manual_disconnects inside stop_mqtt_client
        stop_mqtt_client(device, manual=True)

        sim = simulators.get(device.id)
        if sim:
            try:
                sim.stop()
            except Exception:
                pass
            del simulators[device.id]

        device.status = "offline"
        device.is_connected = False
        device.updated_at = datetime.now(INDIA_TZ)
        db.session.commit()

        socketio.emit("device_status", {
            "device_id": device.id,
            "device_name": device.name,
            "status": "offline",
            "last_seen": device.updated_at.isoformat(),
        })

        emit_dashboard_update()
        emit_global_mqtt_status()
        log_info(f"🔌 Device manually disconnected: {device.name}")
        return jsonify({"message": f"Device '{device.name}' disconnected successfully"}), 200

    except Exception as e:
        db.session.rollback()
        log_info(f"[ERROR] Failed to disconnect device: {e}")
        return jsonify({"error": f"Failed to disconnect device: {e}"}), 500


@device_bp.route("/devices/<int:device_id>", methods=["DELETE"])
def delete_device(device_id):
    device = Device.query.get_or_404(device_id)
    try:
        # Ensure MQTT client cleaned up first (if active)
        try:
            # Attempt to stop client (manual=True will add to manual_disconnects).
            stop_mqtt_client(device, manual=True)
        except Exception:
            pass

        # Ensure in-memory state cleaned even if client stop failed
        try:
            handle_device_deletion(device.id)
        except Exception:
            pass

        db.session.delete(device)
        db.session.commit()

        log_info(f"🗑️ Device deleted: {device.name}")
        emit_event("device_deleted", {"id": device_id, "name": device.name})
        # If no devices left → clear dashboard
        if Device.query.count() == 0:
            emit_dashboard_update()

        return jsonify({"message": "Device deleted"}), 200

    except Exception as e:
        db.session.rollback()
        log_info(f"[ERROR] Failed to delete device: {e}")
        return jsonify({"error": f"Failed to delete device: {e}"}), 500
