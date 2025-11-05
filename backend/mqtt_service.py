# ====================================================================================================================
# backend/mqtt_service.py — Single-Device Manual MQTT Service (thread-safe, eventlet/flask-safe)
# ====================================================================================================================

import json
import re
import threading
import os
import random
import time
from datetime import datetime, timedelta
from pytz import timezone

import paho.mqtt.client as mqtt
from flask import current_app

from backend.extensions import db, socketio
from backend.models import Device, Sensor
from backend.utils.audit import log_info
from backend.utils.dashboard import emit_dashboard_update

# ==========================================================
# Config / Globals
# ==========================================================
KEEPALIVE = int(os.environ.get("MQTT_KEEPALIVE", 60))
INDIA_TZ = timezone("Asia/Kolkata")

_simulators = {}
_mqtt_clients = {}
_manual_disconnects = set()
_last_seen = {}
_active_device_id = None
_flask_app = None

_state_lock = threading.RLock()

_offline_timer = None
_periodic_timer = None
_simulator_thread = None
_simulator_stop = threading.Event()

# ==========================================================
# Helpers
# ==========================================================
def _get_flask_app():
    global _flask_app
    if _flask_app is None:
        try:
            _flask_app = current_app._get_current_object()
        except Exception:
            _flask_app = None
    return _flask_app


def _safe_now():
    return datetime.now(INDIA_TZ)


def _ensure_aware(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return INDIA_TZ.localize(dt)
    return dt.astimezone(INDIA_TZ)


def _parse_payload(payload_text: str):
    try:
        return json.loads(payload_text)
    except Exception:
        try:
            fixed = re.sub(r'(\w+)\s*:', r'"\1":', payload_text)
            return json.loads(fixed)
        except Exception:
            return {"raw": payload_text}

# ==========================================================
# Simulator (HiveMQ / EMQX)
# ==========================================================
def _start_simulated_data(device: Device, broker_host: str):
    """Starts a background thread emitting random data every 5 seconds for HiveMQ/EMQX."""
    global _simulator_thread, _simulator_stop

    if broker_host not in ["broker.hivemq.com", "broker.emqx.io"]:
        return

    _simulator_stop.clear()

    def simulator_loop():
        app = _get_flask_app()
        log_info(f"[SIMULATOR] 🎮 Started for {device.name} on {broker_host}")
        while not _simulator_stop.is_set():
            with _state_lock:
                if _active_device_id != device.id:
                    break
            now = _safe_now()
            data = {
                "temperature": round(random.uniform(25, 40), 2),
                "humidity": round(random.uniform(40, 80), 2),
                "pressure": round(random.uniform(990, 1040), 2),
            }
            log_info(f"[SIMULATOR] 🔄 Generated data for {device.name}: {data}")
            if app:
                with app.app_context():
                    rec = Sensor(
                        device_id=device.id,
                        topic=f"francauto/devices/{device.name}",
                        payload=json.dumps(data),
                        temperature=data["temperature"],
                        humidity=data["humidity"],
                        pressure=data["pressure"],
                        timestamp=now,
                    )
                    db.session.add(rec)
                    db.session.commit()

                    socketio.emit("device_data_update", {
                        "device_id": device.id,
                        "device_name": device.name,
                        **data,
                        "status": "online",
                        "timestamp": now.isoformat(),
                    })
                    emit_dashboard_update(device.id)
            time.sleep(5)
        log_info(f"[SIMULATOR] 🛑 Stopped for {device.name}")

    _simulator_thread = threading.Thread(target=simulator_loop, daemon=True)
    _simulator_thread.start()


def _stop_simulated_data():
    """Stops simulator thread if running."""
    global _simulator_stop
    _simulator_stop.set()

# ==========================================================
# Message Handler
# ==========================================================
def handle_message(device: Device, msg):
    global _last_seen, _active_device_id
    with _state_lock:
        if device.id != _active_device_id:
            log_info(f"[MQTT] ⚠️ Ignoring message from inactive device {device.name}")
            return

    app = _get_flask_app()
    if not app:
        return

    try:
        payload_text = msg.payload.decode(errors="ignore")
    except Exception:
        payload_text = str(msg.payload)

    topic = getattr(msg, "topic", None)
    log_info(f"[MQTT] 📩 Message from {device.name} ({topic}): {payload_text}")

    try:
        if topic == "random/test":
            try:
                rnd = float(payload_text.strip())
            except Exception:
                rnd = random.uniform(0, 100)
            data = {
                "temperature": round(rnd % 40, 2),
                "humidity": round(40 + (rnd % 60), 2),
                "pressure": round(1000 + (rnd % 25), 2),
            }
        else:
            data = _parse_payload(payload_text)

        now = _safe_now()
        with app.app_context():
            device.status = "online"
            device.is_connected = True
            device.updated_at = now
            db.session.commit()
            _last_seen[device.id] = now

            rec = Sensor(
                device_id=device.id,
                topic=topic,
                payload=json.dumps(data),
                temperature=float(data.get("temperature", 0.0)),
                humidity=float(data.get("humidity", 0.0)),
                pressure=float(data.get("pressure", 0.0)),
                timestamp=now,
            )
            db.session.add(rec)
            db.session.commit()

            socketio.emit("device_data_update", {
                "device_id": device.id,
                "device_name": device.name,
                **data,
                "status": "online",
                "timestamp": now.isoformat(),
            })
            emit_dashboard_update(device.id)
            emit_global_mqtt_status()
    except Exception as exc:
        log_info(f"[ERROR] Failed to handle message for {device.name}: {exc}")
        with app.app_context():
            db.session.rollback()

# ==========================================================
# Start / Stop MQTT Client
# ==========================================================
def start_mqtt_client(device: Device) -> bool:
    global _active_device_id, _mqtt_clients

    with _state_lock:
        if _active_device_id is not None:
            log_info(f"[MQTT] ❌ Another device is active. Stop it before connecting {device.name}.")
            return False

        broker_host = (device.host or "").strip().lower()
        if broker_host not in ["test.mosquitto.org", "broker.hivemq.com", "broker.emqx.io"]:
            broker_host = "broker.hivemq.com"

        topic = f"francauto/devices/{device.name}"

        try:
            client = mqtt.Client()
            client.user_data_set({"device_id": device.id})

            def on_message(c, userdata, message):
                handle_message(device, message)

            def on_connect(c, userdata, flags, rc):
                log_info(f"[MQTT] 🔗 Connected rc={rc} to {broker_host}")
                c.subscribe(topic)
                log_info(f"[MQTT] ✅ Subscribed: {topic}")
                if broker_host == "test.mosquitto.org":
                    c.subscribe("random/test")
                    log_info("[MQTT] 🎲 Subscribed to simulated topic random/test")
                else:
                    _start_simulated_data(device, broker_host)

            def on_disconnect(c, userdata, rc):
                log_info(f"[MQTT] 🔌 Disconnected rc={rc} for {device.name}")
                _stop_simulated_data()

            client.on_connect = on_connect
            client.on_message = on_message
            client.on_disconnect = on_disconnect

            client.connect(broker_host, 1883, KEEPALIVE)
            client.loop_start()

            _mqtt_clients[device.id] = client
            _active_device_id = device.id

            app = _get_flask_app()
            if app:
                with app.app_context():
                    device.status = "online"
                    device.is_connected = True
                    device.updated_at = _safe_now()
                    db.session.commit()

            log_info(f"[MQTT] ✅ Device started: {device.name} ({broker_host})")
            emit_dashboard_update(device.id)
            emit_global_mqtt_status()
            return True

        except Exception as e:
            log_info(f"[ERROR] MQTT start failed for {device.name}: {e}")
            return False


def stop_mqtt_client(device: Device, manual: bool = True) -> bool:
    global _active_device_id, _mqtt_clients

    with _state_lock:
        client = _mqtt_clients.pop(device.id, None)
        _stop_simulated_data()
        if client:
            try:
                client.loop_stop()
                client.disconnect()
            except Exception:
                pass
        if _active_device_id == device.id:
            _active_device_id = None

        app = _get_flask_app()
        if app:
            with app.app_context():
                device.status = "offline"
                device.is_connected = False
                device.updated_at = _safe_now()
                db.session.commit()

        socketio.emit("device_status", {
            "device_id": device.id,
            "device_name": device.name,
            "status": "offline",
            "last_seen": _safe_now().isoformat(),
        })
        emit_dashboard_update(device.id)
        emit_global_mqtt_status()

        log_info(f"[MQTT] 🔌 Device disconnected: {device.name}")
        return True

# ==========================================================
# Global MQTT Status
# ==========================================================
def emit_global_mqtt_status():
    app = _get_flask_app()
    if not app:
        return
    with app.app_context():
        online_devices = 1 if _active_device_id else 0
        total_devices = Device.query.count()
        socketio.emit("mqtt_status", {
            "status": "connected" if online_devices else "disconnected",
            "devices_online": online_devices,
            "devices_total": total_devices,
            "timestamp": _safe_now().isoformat(),
        })

# ==========================================================
# Init / Cleanup
# ==========================================================
def reset_all_mqtt_state():
    global _active_device_id, _mqtt_clients
    with _state_lock:
        _active_device_id = None
        _mqtt_clients.clear()
        _stop_simulated_data()
    app = _get_flask_app()
    if app:
        with app.app_context():
            for dev in Device.query.all():
                dev.status = "offline"
                dev.is_connected = False
                dev.updated_at = _safe_now()
            db.session.commit()
    log_info("[MQTT] 🔄 Reset all MQTT states to offline.")


def init_mqtt_system():
    reset_all_mqtt_state()
    log_info("[MQTT] 🧩 MQTT system initialized (manual connect mode).")

# ==========================================================
# Compatibility placeholders for older imports
# ==========================================================
def start_simulator(device):
    """Compatibility stub for old imports — handled automatically now."""
    log_info(f"[SIMULATOR] ⚙️ start_simulator() called for {device.name} — handled internally.")
    return True


def stop_simulator(device):
    """Compatibility stub for old imports."""
    _stop_simulated_data()
    log_info(f"[SIMULATOR] ⚙️ stop_simulator() called for {device.name}.")
    return True

# ==========================================================
# Device Deletion Handler (for cleanup)
# ==========================================================
def handle_device_deletion(device_id: int):
    """Cleanup MQTT connection if the device is deleted."""
    global _active_device_id, _mqtt_clients
    with _state_lock:
        client = _mqtt_clients.pop(device_id, None)
        if client:
            try:
                client.loop_stop()
                client.disconnect()
                log_info(f"[MQTT] 🧹 Cleaned up client for deleted device id={device_id}.")
            except Exception:
                pass

        if _active_device_id == device_id:
            _active_device_id = None
            log_info(f"[MQTT] 🧹 Cleared active device id={device_id} after deletion.")

# ==========================================================
# Exports
# ==========================================================
__all__ = [
    "emit_global_mqtt_status",
    "start_mqtt_client",
    "stop_mqtt_client",
    "reset_all_mqtt_state",
    "init_mqtt_system",
    "start_simulator",
    "stop_simulator",
    "handle_device_deletion",
]
# ==========================================================
# Compatibility Aliases (for older imports)
# ==========================================================
simulators = _simulators
mqtt_clients = _mqtt_clients
manual_disconnects = _manual_disconnects
