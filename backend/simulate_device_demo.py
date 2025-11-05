import json
import time
import random
import paho.mqtt.client as mqtt

client = mqtt.Client()
client.connect("broker.hivemq.com", 1883, 60)

while True:
    payload = {
        "device": "Device-001",
        "temperature": round(random.uniform(20, 35), 2),
        "humidity": round(random.uniform(40, 70), 2),
        "pressure": round(random.uniform(900, 1100), 2),
        "status": "online"
    }
    client.publish("francauto/devices/Device-001", json.dumps(payload))
    print("📤 Sent:", payload)
    time.sleep(5)
