# mqtt_service.py
import json
import paho.mqtt.client as mqtt
from app import db
from backend.models import DeviceData, Device
from datetime import datetime

# MQTT broker details — you can change to your broker (local, HiveMQ Cloud, etc.)
BROKER = "broker.hivemq.com"
PORT = 1883
TOPIC = "francauto/devices/#"

def on_connect(client, userdata, flags, rc):
    print(f"MQTT Connected with result code {rc}")
    client.subscribe(TOPIC)

def on_message(client, userdata, msg):
    print(f" MQTT Message received on {msg.topic}: {msg.payload.decode()}")
    try:
        data = json.loads(msg.payload.decode())

        device_name = data.get("device")
        temperature = data.get("temperature")
        humidity = data.get("humidity")
        pressure = data.get("pressure", None)
        status = data.get("status", "online")

        device = Device.query.filter_by(name=device_name).first()
        if not device:
            device = Device(name=device_name, status=status)
            db.session.add(device)
            db.session.commit()

        record = DeviceData(
            device_id=device.id,
            temperature=temperature,
            humidity=humidity,
            pressure=pressure,
            timestamp=datetime.utcnow()
        )
        db.session.add(record)
        db.session.commit()
        print("Data stored in SQLite")

    except Exception as e:
        print(f"Error processing message: {e}")

def start_mqtt():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(BROKER, PORT, 60)
    client.loop_start()
    print("MQTT Service started and listening for messages...")
