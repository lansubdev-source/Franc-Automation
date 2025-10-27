# backend/mqtt_service.py
import json
import re
import threading
from datetime import datetime, timedelta
import paho.mqtt.client as mqtt
from flask import current_app
from backend.extensions import db, socketio
from backend.models import Device, Sensor

# ==========================================================
# MQTT CONFIGURATION
# ==========================================================
MQTT_BROKER = "test.mosquitto.org"
MQTT_PORT = 1883
MQTT_TOPIC = "francauto/devices/+/data"
CLIENT_ID = "FrancAutoServer"
KEEPALIVE = 60

mqtt_client = None
last_seen = {}  # { device_name: last_timestamp }
flask_app = None  # ✅ Real Flask app reference


# ==========================================================
# PAYLOAD PARSER (FIXED)
# ==========================================================
def parse_payload(payload_text: str):
    """
    Parse payload that may be either proper JSON or pseudo-JSON like:
    {temperature:28.1,humidity:61,pressure:1013.4}
    """
    try:
        # Try direct JSON
        return json.loads(payload_text)
    except json.JSONDecodeError:
        try:
            # Fix pseudo JSON → convert keys to strings
            fixed = re.sub(r'(\w+):', r'"\1":', payload_text)
            return json.loads(fixed)
        except Exception:
            return {"raw": payload_text}


# ==========================================================
# MQTT EVENT: CONNECT
# ==========================================================
def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print(f"[MQTT] ✅ Connected to {MQTT_BROKER}:{MQTT_PORT}")
        client.subscribe(MQTT_TOPIC)
        print(f"[MQTT] 📡 Subscribed to {MQTT_TOPIC}")
    else:
        print(f"[MQTT] ❌ Connection failed (rc={rc})")


# ==========================================================
# MQTT EVENT: MESSAGE RECEIVED
# ==========================================================
def on_message(client, userdata, msg):
    global flask_app
    payload_text = msg.payload.decode(errors="ignore")
    topic = msg.topic
    print(f"\n[MQTT] 📩 Received on {topic}: {payload_text}")

    try:
        # Parse data safely
        data = parse_payload(payload_text)
        parts = topic.split('/')
        device_name = parts[2] if len(parts) >= 3 else "unknown"

        with flask_app.app_context():
            # Find device
            device = Device.query.filter_by(name=device_name).first()
            if not device:
                print(f"[MQTT] ⚠️ Unknown device '{device_name}'. Ignored.")
                return

            # Update status
            device.status = "online"
            device.updated_at = datetime.utcnow()
            db.session.commit()
            last_seen[device.name] = datetime.utcnow()

            # ✅ Extract numeric data
            temperature = float(data.get("temperature", 0.0)) if isinstance(data, dict) else 0.0
            humidity = float(data.get("humidity", 0.0)) if isinstance(data, dict) else 0.0
            pressure = float(data.get("pressure", 0.0)) if isinstance(data, dict) else 0.0

            # ✅ Store record
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
            print(f"[DB] 💾 Stored sensor data for {device.name} — "
                  f"T={temperature}, H={humidity}, P={pressure}")

            # ✅ Emit updates via SocketIO
            socketio.emit("device_status", {
                "device_id": device.id,
                "device_name": device.name,
                "status": "online",
                "last_seen": datetime.utcnow().isoformat()
            })
            socketio.emit("dashboard_update", {
                "temperature": temperature,
                "humidity": humidity,
                "pressure": pressure,
                "devices_online": Device.query.filter_by(status="online").count(),
                "timestamp": datetime.utcnow().isoformat()
            })

    except Exception as e:
        with flask_app.app_context():
            db.session.rollback()
        print(f"[ERROR] ❗ MQTT processing failed: {e}")


# ==========================================================
# OFFLINE DEVICE CHECKER
# ==========================================================
def check_offline_devices():
    """Mark devices offline if no data for > 2 minutes."""
    global flask_app
    with flask_app.app_context():
        now = datetime.utcnow()
        offline_threshold = timedelta(minutes=2)
        for device_name, last_time in list(last_seen.items()):
            if now - last_time > offline_threshold:
                device = Device.query.filter_by(name=device_name).first()
                if device and device.status != "offline":
                    device.status = "offline"
                    db.session.commit()
                    print(f"[DEVICE] 🔴 Marked {device_name} as offline")

                    socketio.emit("device_status", {
                        "device_id": device.id,
                        "device_name": device.name,
                        "status": "offline",
                        "last_seen": last_time.isoformat()
                    })
                    last_seen.pop(device_name, None)

    threading.Timer(30, check_offline_devices).start()


# ==========================================================
# MQTT STARTUP
# ==========================================================
def start_mqtt():
    """Start MQTT background service."""
    global mqtt_client, flask_app

    from flask import current_app
    flask_app = current_app._get_current_object()

    try:
        mqtt_client = mqtt.Client(
            client_id=CLIENT_ID,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION1
        )
        mqtt_client.on_connect = on_connect
        mqtt_client.on_message = on_message

        print(f"[MQTT] 🔄 Connecting to {MQTT_BROKER}:{MQTT_PORT} ...")
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, KEEPALIVE)
        mqtt_client.loop_start()
        print(f"[MQTT] ✅ MQTT client started")

        # Start background offline checker
        threading.Timer(30, check_offline_devices).start()

    except Exception as e:
        print(f"[MQTT] ⚠️ Connection exception: {e}")


# ==========================================================
# TOPIC SUBSCRIBE HELPER
# ==========================================================
def subscribe_device(client, device_name: str):
    topic = f"francauto/devices/{device_name}/data"
    client.subscribe(topic)
    print(f"[MQTT] 📡 Subscribed to {topic}")
