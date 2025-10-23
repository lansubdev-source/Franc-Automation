import json
import paho.mqtt.client as mqtt
from datetime import datetime
from backend.extensions import db, socketio
from backend.models import Device, SensorData
from app import app   # Import Flask app for context

# MQTT broker configuration
MQTT_BROKER = "test.mosquitto.org"
MQTT_PORT = 1883
MQTT_TOPIC = "francauto/devices/+/data"
CLIENT_ID = "FrancAutoServer"
KEEPALIVE = 60


def parse_payload(payload_text: str):
    """Try to parse JSON; fallback to plain text dict."""
    try:
        return json.loads(payload_text)
    except Exception:
        return {"raw": payload_text}


def on_connect(client, userdata, flags, rc, properties=None):
    """When connected to MQTT broker."""
    if rc == 0:
        print(f"[MQTT] ✅ Connected to {MQTT_BROKER}:{MQTT_PORT}")
        client.subscribe(MQTT_TOPIC)
        print(f"[MQTT] 📡 Subscribed to {MQTT_TOPIC}")
    else:
        print(f"[MQTT] ❌ Connection failed with rc={rc}")


def on_message(client, userdata, msg):
    """Handle incoming MQTT message."""
    payload_text = msg.payload.decode(errors="ignore")
    print(f"\n[MQTT] 📩 Received on {msg.topic}: {payload_text}")

    with app.app_context():
        try:
            data = parse_payload(payload_text)

            # Extract device name from topic
            parts = msg.topic.split('/')
            device_name = parts[2] if len(parts) >= 3 else "unknown"

            # Ensure Device exists or create
            device = Device.query.filter_by(name=device_name).first()
            if not device:
                device = Device(
                    name=device_name,
                    protocol="mqtt",
                    host=MQTT_BROKER,
                    port=MQTT_PORT,
                    status="online",
                    updated_at=datetime.utcnow()
                )
                db.session.add(device)
                db.session.commit()
                print(f"[DB] 🆕 Created new device: {device.name}")
            else:
                device.status = "online"
                device.updated_at = datetime.utcnow()
                db.session.commit()
                print(f"[DB] 🔁 Updated existing device: {device.name}")

            # Parse readings
            temperature = float(data.get("temperature", 0)) if isinstance(data, dict) else None
            humidity = float(data.get("humidity", 0)) if isinstance(data, dict) else None
            pressure = float(data.get("pressure", 0)) if isinstance(data, dict) else None

            # Store sensor data
            record = SensorData(
                device_id=device.id,
                topic=msg.topic,
                payload=payload_text,
                temperature=temperature,
                humidity=humidity,
                pressure=pressure,
                timestamp=datetime.utcnow()
            )
            db.session.add(record)
            db.session.commit()
            print(f"[DB] 💾 Stored data (record id={record.id})")

            # Emit Socket.IO update in flat format
            emit_payload = {
                "device_id": device.id,
                "device_name": device.name,
                "temperature": temperature,
                "humidity": humidity,
                "pressure": pressure,
                "timestamp": record.timestamp.isoformat()
            }
            socketio.emit("update_data", emit_payload)
            print(f"[SOCKET] 🚀 Emitted 'update_data': {emit_payload}")

        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] ❗ MQTT processing failed: {e}")


def start_mqtt():
    """Start MQTT client."""
    try:
        client = mqtt.Client(client_id=CLIENT_ID, callback_api_version=mqtt.CallbackAPIVersion.VERSION1)
        client.on_connect = on_connect
        client.on_message = on_message

        print(f"[MQTT] 🔄 Connecting to {MQTT_BROKER}:{MQTT_PORT} ...")
        client.connect(MQTT_BROKER, MQTT_PORT, KEEPALIVE)
        client.loop_forever()
    except Exception as e:
        print(f"[MQTT] ⚠️ Connection exception: {e}")

