# ==========================================================
# backend/mqtt_service.py — Dynamic MQTT with conditional simulation
# ==========================================================
import json
import re
import threading
import random
import time
from datetime import datetime, timedelta
import paho.mqtt.client as mqtt
from flask import current_app
from backend.extensions import db, socketio
from backend.models import Device, Sensor

KEEPALIVE = 60
active_clients = {}  # { device_id: mqtt_client }
last_seen = {}
flask_app = None
simulator_thread = None
stop_simulator_flag = threading.Event()


# ==========================================================
# Parse Payload
# ==========================================================
def parse_payload(payload_text: str):
    try:
        return json.loads(payload_text)
    except json.JSONDecodeError:
        try:
            fixed = re.sub(r'(\w+):', r'"\1":', payload_text)
            return json.loads(fixed)
        except Exception:
            return {"raw": payload_text}


# ==========================================================
# Handle incoming MQTT message
# ==========================================================
def handle_message(device, msg):
    global flask_app
    payload_text = msg.payload.decode(errors="ignore")
    topic = msg.topic
    print(f"[MQTT] 📩 Received from {device.name}: {payload_text}")

    try:
        data = parse_payload(payload_text)
        with flask_app.app_context():
            device.status = "online"
            device.updated_at = datetime.utcnow()
            db.session.commit()
            last_seen[device.name] = datetime.utcnow()

            temperature = float(data.get("temperature", 0.0))
            humidity = float(data.get("humidity", 0.0))
            pressure = float(data.get("pressure", 0.0))

            record = Sensor(
                device_id=device.id,
                topic=topic,
                payload=payload_text,
                temperature=temperature,
                humidity=humidity,
                pressure=pressure,
                timestamp=datetime.utcnow()
            )
            db.session.add(record)
            db.session.commit()
            print(f"[DB] 💾 Saved for {device.name}: T={temperature}, H={humidity}, P={pressure}")

            # Emit to frontend
            socketio.emit("device_status", {
                "device_id": device.id,
                "device_name": device.name,
                "status": "online",
                "last_seen": datetime.utcnow().isoformat()
            })
            socketio.emit("dashboard_update", {
                "device_id": device.id,
                "device_name": device.name,
                "temperature": temperature,
                "humidity": humidity,
                "pressure": pressure,
                "devices_online": Device.query.filter_by(status='online').count(),
                "timestamp": datetime.utcnow().isoformat()
            })

    except Exception as e:
        with flask_app.app_context():
            db.session.rollback()
        print(f"[ERROR] ❗ Failed to process message for {device.name}: {e}")


# ==========================================================
# Start MQTT client for a device
# ==========================================================
def start_device_mqtt(device):
    global active_clients, flask_app, stop_simulator_flag

    # Stop all previous clients — only one device at a time
    for d_id in list(active_clients.keys()):
        stop_device_mqtt(d_id)

    # Stop simulator if running
    stop_simulator_flag.set()
    time.sleep(1)

    if not flask_app:
        from flask import current_app
        flask_app = current_app._get_current_object()

    if not device.host:
        print(f"[MQTT] ⚠️ Device {device.name} missing host — skipped.")
        return

    try:
        client = mqtt.Client(
            client_id=f"FrancAuto_{device.id}",
            callback_api_version=mqtt.CallbackAPIVersion.VERSION1
        )

        def on_connect(c, u, flags, rc, p=None):
            if rc == 0:
                topic = f"francauto/devices/{device.name}/data"
                c.subscribe(topic)
                print(f"[MQTT] ✅ {device.name} connected to {device.host}:{device.port} — Subscribed {topic}")
            else:
                print(f"[MQTT] ❌ Failed to connect {device.name} (rc={rc})")

        def on_message(c, u, msg):
            handle_message(device, msg)

        client.on_connect = on_connect
        client.on_message = on_message
        client.connect(device.host, int(device.port or 1883), KEEPALIVE)
        client.loop_start()

        active_clients[device.id] = client
        print(f"[MQTT] 🚀 Started client for {device.name}")

        # ✅ Start simulator only for test.mosquitto.org
        if "test.mosquitto.org" in device.host.lower():
            start_simulator(device)

    except Exception as e:
        print(f"[MQTT] ⚠️ Could not start {device.name}: {e}")


# ==========================================================
# Stop MQTT client
# ==========================================================
def stop_device_mqtt(device_id):
    global stop_simulator_flag

    client = active_clients.get(device_id)
    if client:
        client.loop_stop()
        client.disconnect()
        active_clients.pop(device_id, None)
        print(f"[MQTT] ⛔ Stopped client for device {device_id}")

    # Stop simulator if no devices remain
    with flask_app.app_context():
        if Device.query.count() == 0:
            stop_simulator_flag.set()
            socketio.emit("dashboard_update", {
                "temperature": None,
                "humidity": None,
                "pressure": None,
                "devices_online": 0,
                "timestamp": datetime.utcnow().isoformat()
            })
            print("[MQTT] ⚪ No devices remaining — dashboard cleared.")


# ==========================================================
# Start random data simulator (for test.mosquitto.org)
# ==========================================================
def start_simulator(device):
    """Simulate random data for test.mosquitto.org."""
    global simulator_thread, stop_simulator_flag
    stop_simulator_flag.clear()

    def simulator_loop():
        print(f"[SIMULATOR] 🧠 Started for {device.host}")
        while not stop_simulator_flag.is_set():
            with flask_app.app_context():
                if Device.query.count() == 0:
                    break

                temperature = round(random.uniform(20, 35), 1)
                humidity = round(random.uniform(40, 80), 1)
                pressure = round(random.uniform(980, 1050), 1)

                socketio.emit("dashboard_update", {
                    "device_id": device.id,
                    "device_name": device.name,
                    "temperature": temperature,
                    "humidity": humidity,
                    "pressure": pressure,
                    "devices_online": 1,
                    "timestamp": datetime.utcnow().isoformat()
                })

                print(f"[SIMULATOR] 🔹 Data sent for {device.name}: T={temperature}, H={humidity}, P={pressure}")
            time.sleep(5)
        print("[SIMULATOR] 🛑 Stopped.")

    simulator_thread = threading.Thread(target=simulator_loop, daemon=True)
    simulator_thread.start()


# ==========================================================
# Periodically mark offline devices
# ==========================================================
def check_offline_devices():
    global flask_app
    with flask_app.app_context():
        now = datetime.utcnow()
        offline_threshold = timedelta(minutes=2)
        for name, last_time in list(last_seen.items()):
            if now - last_time > offline_threshold:
                device = Device.query.filter_by(name=name).first()
                if device and device.status != "offline":
                    device.status = "offline"
                    db.session.commit()
                    print(f"[DEVICE] 🔴 {name} marked offline")
                    socketio.emit("device_status", {
                        "device_id": device.id,
                        "device_name": name,
                        "status": "offline",
                        "last_seen": last_time.isoformat()
                    })
                    last_seen.pop(name, None)
    threading.Timer(30, check_offline_devices).start()


# ==========================================================
# Start all devices (on app startup)
# ==========================================================
def start_all_mqtt():
    global flask_app
    from flask import current_app
    flask_app = current_app._get_current_object()

    print("[MQTT] 🔄 Starting dynamic MQTT connections for all devices...")
    with flask_app.app_context():
        devices = Device.query.all()
        if not devices:
            print("[MQTT] ⚠️ No devices found in database.")
        for device in devices:
            start_device_mqtt(device)

    threading.Timer(30, check_offline_devices).start()
    print("[MQTT] ✅ All device MQTT clients started.")


# ==========================================================
# Reload MQTT when device updated
# ==========================================================
def reload_device(device):
    stop_device_mqtt(device.id)
    start_device_mqtt(device)
