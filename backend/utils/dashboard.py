# ==========================================================
# backend/utils/dashboard.py — Enhanced live dashboard emitter (India Time)
# ==========================================================
from backend.models import Sensor, Device
from backend.extensions import socketio
from datetime import datetime
from pytz import timezone

# ✅ Indian timezone constant
INDIA_TZ = timezone("Asia/Kolkata")


def emit_dashboard_update(device_id=None):
    """
    Emit real-time dashboard data to all connected clients.
    If device_id is given, only that device’s latest data is used.
    Otherwise, aggregates across all online devices.
    The dashboard will correctly show 'offline' when no devices are active.
    """

    # ----------------------------------------------------------
    # Get device(s)
    # ----------------------------------------------------------
    if device_id:
        device = Device.query.get(device_id)
        devices = [device] if device else []
    else:
        devices = Device.query.filter_by(status="online").all()

    # ----------------------------------------------------------
    # Collect latest readings
    # ----------------------------------------------------------
    temperature = None
    humidity = None
    pressure = None

    for dev in devices:
        latest_sensor = (
            Sensor.query.filter_by(device_id=dev.id)
            .order_by(Sensor.timestamp.desc())
            .first()
        )
        if latest_sensor:
            temperature = latest_sensor.temperature
            humidity = latest_sensor.humidity
            pressure = latest_sensor.pressure
            break  # ✅ Use latest available reading

    # ----------------------------------------------------------
    # Devices count
    # ----------------------------------------------------------
    devices_online = Device.query.filter_by(status="online").count()

    # ----------------------------------------------------------
    # Build payload
    # ----------------------------------------------------------
    data = {
        "temperature": round(temperature, 1) if temperature is not None else None,
        "humidity": round(humidity, 1) if humidity is not None else None,
        "pressure": round(pressure, 1) if pressure is not None else None,
        "devices_online": devices_online,
        "status": "online" if devices_online > 0 else "offline",
        "timestamp": datetime.now(INDIA_TZ).isoformat(),  # ✅ India local time
    }

    # ----------------------------------------------------------
    # Emit via Socket.IO
    # ----------------------------------------------------------
    socketio.emit("dashboard_update", data)
    print(f"[DASHBOARD] 📤 Emitted dashboard_update: {data}")

