# ======================================
# history_routes.py — Export Per Day | FIXED
# ======================================

from flask import Blueprint, jsonify, request, make_response
from datetime import datetime, timedelta
from io import BytesIO
import csv
import json

from backend.models import db, History

# Correct Blueprint URL prefix matching frontend calls
history_bp = Blueprint("history", __name__, url_prefix="/api/history")

# Default days range
DAYS = 7

# ======================================
# GET: Grouped History JSON (Last 7 Days)
# ======================================
@history_bp.route("/", methods=["GET"])
def get_history():
    since = datetime.utcnow() - timedelta(days=DAYS)

    records = (
        History.query.filter(History.timestamp >= since)
        .order_by(History.timestamp.desc())
        .all()
    )

    grouped = {}
    for rec in records:
        date_key = rec.timestamp.strftime("%Y-%m-%d")
        if date_key not in grouped:
            grouped[date_key] = []
        grouped[date_key].append(rec.to_dict())

    return jsonify({"status": "success", "data": grouped})


# ======================================
# EXPORT JSON (per-day)
# Example: /api/history/export/json?date=2025-11-21
# ======================================
@history_bp.route("/export/json", methods=["GET"])
def export_json():
    date = request.args.get("date")
    if not date:
        return jsonify({"status": "error", "message": "Missing ?date=YYYY-MM-DD"}), 400

    try:
        start = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid date format"}), 400

    end = start + timedelta(days=1)

    records = History.query.filter(
        History.timestamp >= start, History.timestamp < end
    ).all()

    payload = [r.to_dict() for r in records]

    response = make_response(json.dumps(payload, indent=2))
    response.headers["Content-Disposition"] = f"attachment; filename=history_{date}.json"
    response.headers["Content-Type"] = "application/json"
    return response


# ======================================
# EXPORT CSV (per-day)
# Example: /api/history/export/csv?date=2025-11-21
# ======================================
@history_bp.route("/export/csv", methods=["GET"])
def export_csv():
    date = request.args.get("date")
    if not date:
        return jsonify({"status": "error", "message": "Missing ?date=YYYY-MM-DD"}), 400

    try:
        start = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid date format"}), 400

    end = start + timedelta(days=1)

    records = History.query.filter(
        History.timestamp >= start, History.timestamp < end
    ).all()

    output = BytesIO()
    writer = csv.writer(output)
    writer.writerow(["device_id", "temperature", "humidity", "pressure", "timestamp"])

    for r in records:
        writer.writerow(
            [
                r.device_id,
                r.temperature,
                r.humidity,
                r.pressure,
                r.timestamp.isoformat(),
            ]
        )

    output.seek(0)

    response = make_response(output.read())
    response.headers["Content-Disposition"] = (
        f"attachment; filename=history_{date}.csv"
    )
    response.headers["Content-Type"] = "text/csv"
    return response
