"""
Utility Scripts for Sensor Management
Run these manually:
👉 python -m scripts.sensor_scripts seed
👉 python -m scripts.sensor_scripts simulate
👉 python -m scripts.sensor_scripts clear
"""

import sys
import random
import time
from datetime import datetime
from faker import Faker

from app import create_app
from backend.extensions import db
from backend.models import Device, Sensor  # ✅ unified model name

fake = Faker()
app = create_app()


# ------------------------------------------------------
# 🧪 Seed Fake Sensor Data for Testing
# ------------------------------------------------------
def seed_sensors(count=10):
    with app.app_context():
        devices = Device.query.all()
        if not devices:
            print("⚠️ No devices found. Please create at least one device first.")
            return

        for _ in range(count):
            device = random.choice(devices)
            data = Sensor(
                device_id=device.id,
                topic=f"devices/{device.id}/sensor",
                payload=fake.json(data_columns={"status": "active", "voltage": random.uniform(3.0, 4.2)}),
                temperature=round(random.uniform(20.0, 35.0), 2),
                humidity=round(random.uniform(30.0, 90.0), 2),
                pressure=round(random.uniform(950.0, 1050.0), 2),
                timestamp=datetime.utcnow(),
            )
            db.session.add(data)

        db.session.commit()
        print(f"✅ {count} fake sensor data entries added successfully.")


# ------------------------------------------------------
# 🚀 Simulate Live MQTT Sensor Data Insertion
# ------------------------------------------------------
def simulate_mqtt(device_name=None, interval=5):
    with app.app_context():
        if device_name:
            device = Device.query.filter_by(name=device_name).first()
            if not device:
                print(f"❌ Device '{device_name}' not found.")
                return
            devices = [device]
        else:
            devices = Device.query.all()

        if not devices:
            print("⚠️ No devices found.")
            return

        print(f"🚀 Simulating sensor data every {interval} seconds... (Ctrl+C to stop)")
        try:
            while True:
                for device in devices:
                    new_data = Sensor(
                        device_id=device.id,
                        topic=f"devices/{device.id}/sensor",
                        payload=fake.json(data_columns={"status": "ok", "signal_strength": random.randint(50, 100)}),
                        temperature=round(random.uniform(18.0, 36.0), 2),
                        humidity=round(random.uniform(40.0, 85.0), 2),
                        pressure=round(random.uniform(960.0, 1040.0), 2),
                        timestamp=datetime.utcnow(),
                    )
                    db.session.add(new_data)
                    db.session.commit()
                    print(f"📡 Added data for {device.name}: Temp {new_data.temperature}°C, Humidity {new_data.humidity}%")

                time.sleep(interval)
        except KeyboardInterrupt:
            print("\n🛑 Simulation stopped by user.")


# ------------------------------------------------------
# 🧹 Clear Sensor Data Table
# ------------------------------------------------------
def clear_sensors():
    with app.app_context():
        num_rows = db.session.query(Sensor).delete()
        db.session.commit()
        print(f"🧹 Cleared {num_rows} sensor entries.")


# ------------------------------------------------------
# CLI Command Handler
# ------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.sensor_scripts [seed|simulate|clear]")
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "seed":
        count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        seed_sensors(count)
    elif command == "simulate":
        device_name = sys.argv[2] if len(sys.argv) > 2 else None
        interval = int(sys.argv[3]) if len(sys.argv) > 3 else 5
        simulate_mqtt(device_name, interval)
    elif command == "clear":
        clear_sensors()
    else:
        print("❌ Invalid command. Use one of: seed | simulate | clear")
