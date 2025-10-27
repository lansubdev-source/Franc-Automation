from backend.models import Sensor, Device
from backend.extensions import socketio

def emit_dashboard_update():
    """
    Calculate latest metrics and emit a Socket.IO event to the frontend dashboard.
    """
    # Latest sensor data across all devices
    latest_sensor = Sensor.query.order_by(Sensor.timestamp.desc()).first()
    temperature = latest_sensor.temperature if latest_sensor else 0
    humidity = latest_sensor.humidity if latest_sensor else 0
    pressure = latest_sensor.pressure if latest_sensor else 0

    # Devices online count (example: status='online')
    devices_online = Device.query.filter_by(status="online").count()

    data = {
        "temperature": temperature,
        "humidity": humidity,
        "pressure": pressure,
        "devices_online": devices_online
    }

    # Emit via Socket.IO
    socketio.emit("dashboard_update", data)
