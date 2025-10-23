from flask import Blueprint, request, jsonify
from backend.models import SensorData
from datetime import datetime

data_bp = Blueprint("data_bp", __name__)

# -------------------------------
# 🔹 Get the latest sensor reading (any device)
# -------------------------------
@data_bp.route("/data/latest", methods=["GET"])
def get_latest():
    latest_entry = SensorData.query.order_by(SensorData.timestamp.desc()).first()
    if not latest_entry:
        return jsonify({"message": "No data found"}), 200
    return jsonify(latest_entry.to_dict()), 200


# -------------------------------
# 🔹 Get historical data (filter by device, time, limit)
# -------------------------------
@data_bp.route("/data/history", methods=["GET"])
def get_history():
    """Returns historical sensor readings."""
    q = SensorData.query

    # Optional filters
    device_id = request.args.get("device_id")
    if device_id:
        try:
            q = q.filter(SensorData.device_id == int(device_id))
        except ValueError:
            return jsonify({"error": "Invalid device_id"}), 400

    since = request.args.get("since")
    if since:
        try:
            since_dt = datetime.fromisoformat(since)
            q = q.filter(SensorData.timestamp >= since_dt)
        except Exception:
            return jsonify({"error": "Invalid 'since' timestamp format. Use ISO 8601."}), 400

    limit = request.args.get("limit", 200)
    try:
        limit = int(limit)
    except ValueError:
        limit = 200

    rows = q.order_by(SensorData.timestamp.desc()).limit(limit).all()
    return jsonify([r.to_dict() for r in reversed(rows)]), 200


# -------------------------------
# 🔹 Get latest reading for a specific device
# -------------------------------
@data_bp.route("/data/device/<int:device_id>/latest", methods=["GET"])
def get_latest_for_device(device_id):
    """Return the most recent data entry for a given device."""
    row = SensorData.query.filter_by(device_id=device_id)\
        .order_by(SensorData.timestamp.desc()).first()

    if not row:
        return jsonify({"message": "No data found for this device"}), 200

    return jsonify(row.to_dict()), 200
