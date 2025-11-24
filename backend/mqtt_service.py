# =================================================================================================
# Franc Automation - MQTT Service (Final Stable Anti-Flicker Build v3 with History Logging)
# Handles:
#   • Real & simulated MQTT data ingestion
#   • Stores in BOTH Sensor (live) + History (archive)
#   • Socket.IO updates to Dashboard / Live / Devices
#   • Stable connection state, no flicker
# =================================================================================================
import eventlet
eventlet.monkey_patch(all=True)

import json
import re
import threading
import os
import random
import socket
from datetime import datetime
from pytz import timezone
import paho.mqtt.client as mqtt
from flask import current_app
from backend.extensions import db, socketio
from backend.models import Device, Sensor, History     # <-- ✔ Added History Model
from backend.utils.audit import log_info

# ==========================================================
# Globals / Config
# ==========================================================
KEEPALIVE = int(os.environ.get("MQTT_KEEPALIVE", 60))
INDIA_TZ = timezone("Asia/Kolkata")

_active_device_id = None
_mqtt_clients = {}
_flask_app = None
_state_lock = threading.RLock()

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


def _format_time(dt: datetime):
    dt = dt.astimezone(INDIA_TZ)
    iso = dt.isoformat(timespec="seconds")
    ms = int(dt.timestamp() * 1000)
    return iso, ms


def _num(value):
    try:
        return float(value or 0.0)
    except Exception:
        return 0.0


def reachable_broker(host, port=1883, timeout=3):
    try:
        socket.create_connection((host, port), timeout=timeout)
        return True
    except Exception:
        return False


def _parse_payload(payload_text: str):
    try:
        data = json.loads(payload_text)
    except Exception:
        try:
            fixed = re.sub(r'(\w+)\s*:', r'"\1":', payload_text)
            data = json.loads(fixed)
        except Exception:
            data = {"raw": payload_text}

    norm = {}
    for k, v in data.items():
        k = str(k).lower()
        if k in ("temperature", "temp", "t"):
            norm["temperature"] = _num(v)
        elif k in ("humidity", "hum", "h"):
            norm["humidity"] = _num(v)
        elif k in ("pressure", "press", "p"):
            norm["pressure"] = _num(v)

    norm.setdefault("temperature", 0.0)
    norm.setdefault("humidity", 0.0)
    norm.setdefault("pressure", 0.0)
    return norm


# ==========================================================
# New — Global MQTT Status Broadcaster (FIX)
# ==========================================================
def emit_global_mqtt_status(force_offline=False):
    """Emit global status for dashboards, prevents flicker."""
    app = _get_flask_app()
    if not app:
        return
    
    with app.app_context():
        online = 1 if (_active_device_id and not force_offline) else 0
        total = Device.query.count()
        iso, ms = _format_time(_safe_now())

        payload = {
            "status": "connected" if online else "disconnected",
            "devices_online": online,
            "devices_total": total,
            "timestamp_iso": iso if online else "--",
            "timestamp_ms": ms if online else "--",
        }

        socketio.emit("mqtt_status", payload, namespace="/")
        print(f"[MQTT STATUS] → {payload}")


# ==========================================================
# Unified emitters
# ==========================================================
def _emit_all(device, temperature, humidity, pressure, status):
    app = _get_flask_app()
    if not app:
        return

    now = _safe_now()
    iso, _ = _format_time(now)

    device_id = getattr(device, "id", None) if device else None
    name = getattr(device, "name", "Unknown") if device else "Unknown"

    payload = {
        "device_id": device_id,
        "device_name": name,
        "temperature": _num(temperature),
        "humidity": _num(humidity),
        "pressure": _num(pressure),
        "status": status,
        "timestamp": iso,
        "devices_online": 1 if status == "online" else 0,
    }

    with app.app_context():
        socketio.emit("sensor_data", payload, namespace="/")
        socketio.emit("device_data_update", payload, namespace="/")
        socketio.emit("dashboard_update", payload, namespace="/")
        socketio.emit(
            "device_status",
            {"device_id": device_id, "status": status, "last_seen": iso},
            namespace="/",
        )

    print(
        f"[EMIT] → {name} {status.upper()} | "
        f"T={payload['temperature']}°C H={payload['humidity']}% P={payload['pressure']} | {iso}"
    )


# ==========================================================
# SIMULATOR + HISTORY STORAGE
# ==========================================================
def _start_simulator(device, host, interval=2.0):
    global _simulator_thread
    _stop_simulator()

    if host not in ("broker.hivemq.com", "broker.emqx.io", "test.mosquitto.org"):
        return

    _simulator_stop.clear()

    def sim_loop():
        log_info(f"[SIMULATOR] 🎮 Started for {device.name} ({host})")
        app = _get_flask_app()

        while not _simulator_stop.is_set():
            if _active_device_id != device.id or not device.is_connected:
                break

            now = _safe_now()
            data = {
                "temperature": round(random.uniform(22.0, 36.0), 2),
                "humidity": round(random.uniform(35.0, 75.0), 2),
                "pressure": round(random.uniform(990.0, 1035.0), 2),
            }

            if app:
                with app.app_context():
                    # Live storage
                    s = Sensor(
                        device_id=device.id,
                        topic=f"francauto/devices/{device.name}",
                        payload=json.dumps(data),
                        temperature=data["temperature"],
                        humidity=data["humidity"],
                        pressure=data["pressure"],
                        timestamp=now,
                    )
                    db.session.add(s)

                    # Archive storage (NEW)
                    h = History(
                        device_id=device.id,
                        temperature=data["temperature"],
                        humidity=data["humidity"],
                        pressure=data["pressure"],
                        timestamp=now,
                    )
                    db.session.add(h)

                    device.last_seen = now
                    device.status = "online"
                    device.is_connected = True
                    db.session.commit()

            _emit_all(device, **data, status="online")
            emit_global_mqtt_status(force_offline=False)
            eventlet.sleep(interval)

        log_info(f"[SIMULATOR] 🛑 Stopped for {device.name}")

    _simulator_thread = eventlet.spawn(sim_loop)


def _stop_simulator():
    _simulator_stop.set()
    global _simulator_thread
    if _simulator_thread:
        try:
            _simulator_thread.kill()
        except Exception:
            pass
        _simulator_thread = None


# ==========================================================
# REAL MQTT MESSAGE HANDLER + HISTORY
# ==========================================================
def handle_message(device, msg):
    app = _get_flask_app()
    if not app:
        return

    try:
        payload_text = msg.payload.decode(errors="ignore")
    except Exception:
        payload_text = str(msg.payload)

    data = _parse_payload(payload_text)
    now = _safe_now()

    with app.app_context():
        s = Sensor(
            device_id=device.id,
            topic=getattr(msg, "topic", f"francauto/devices/{device.name}"),
            payload=json.dumps(data),
            temperature=data["temperature"],
            humidity=data["humidity"],
            pressure=data["pressure"],
            timestamp=now,
        )
        db.session.add(s)

        h = History(
            device_id=device.id,
            temperature=data["temperature"],
            humidity=data["humidity"],
            pressure=data["pressure"],
            timestamp=now,
        )
        db.session.add(h)

        device.status = "online"
        device.is_connected = True
        device.last_seen = now
        db.session.commit()

    _emit_all(device, **data, status="online")
    emit_global_mqtt_status(force_offline=False)


# ==========================================================
# CONNECT / DISCONNECT
# ==========================================================
def start_mqtt_client(device):
    global _active_device_id, _mqtt_clients

    with _state_lock:
        if _active_device_id:
            log_info(f"[MQTT] ❌ Another device already active.")
            return False

        host = (device.host or "broker.hivemq.com").strip().lower()
        topic = f"francauto/devices/{device.name}"

        if not reachable_broker(host, 1883, 3):
            log_info(f"[MQTT] ⚠️ Broker {host} unreachable → staying offline.")
            app = _get_flask_app()
            if app:
                with app.app_context():
                    device.status = "offline"
                    device.is_connected = False
                    db.session.commit()
            _emit_all(device, 0, 0, 0, "offline")
            emit_global_mqtt_status(force_offline=True)
            return False

        try:
            client = mqtt.Client()
            client.on_connect = lambda c, u, f, rc: c.subscribe(topic)
            client.on_message = lambda c, u, m: handle_message(device, m)
            client.connect(host, 1883, KEEPALIVE)
            client.loop_start()

            _mqtt_clients[device.id] = client
            _active_device_id = device.id

            app = _get_flask_app()
            if app:
                with app.app_context():
                    device.status = "online"
                    device.is_connected = True
                    device.last_seen = _safe_now()
                    db.session.commit()

            _start_simulator(device, host)
            emit_global_mqtt_status(force_offline=False)
            log_info(f"[MQTT] ✔ Device {device.name} started successfully")
            return True

        except Exception as e:
            log_info(f"[MQTT] ❌ Connection failed for {device.name}: {e}")
            app = _get_flask_app()
            if app:
                with app.app_context():
                    device.status = "offline"
                    device.is_connected = False
                    db.session.commit()
            _emit_all(device, 0, 0, 0, "offline")
            emit_global_mqtt_status(force_offline=True)
            return False


def stop_mqtt_client(device):
    global _active_device_id, _mqtt_clients
    with _state_lock:
        client = _mqtt_clients.pop(device.id, None)
        _stop_simulator()

        if client:
            try:
                client.loop_stop()
                client.disconnect()
            except Exception:
                pass

        _active_device_id = None

        app = _get_flask_app()
        if app:
            with app.app_context():
                device.status = "offline"
                device.is_connected = False
                device.last_seen = _safe_now()
                db.session.commit()

        _emit_all(device, 0, 0, 0, "offline")
        emit_global_mqtt_status(force_offline=True)
        log_info(f"[MQTT] 🔌 Device {device.name} disconnected cleanly")
        return True


# ==========================================================
# RESET & INIT
# ==========================================================
def reset_all_mqtt_state():
    global _active_device_id, _mqtt_clients
    _active_device_id = None
    _mqtt_clients.clear()
    _stop_simulator()

    app = _get_flask_app()
    if app:
        with app.app_context():
            for d in Device.query.all():
                d.status = "offline"
                d.is_connected = False
                d.last_seen = _safe_now()
            db.session.commit()

    emit_global_mqtt_status(force_offline=True)
    log_info("[MQTT] 🔄 Reset all devices to offline")


def init_mqtt_system():
    reset_all_mqtt_state()
    log_info("[MQTT] 🧩 MQTT system initialized")


# ==========================================================
# Public wrappers
# ==========================================================
def start_simulator(device):
    host = (getattr(device, "host", "") or "").strip().lower()
    _start_simulator(device, host, 2.0)
    return True


def stop_simulator(device):
    _stop_simulator()
    return True


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
]
