# backend/routes/dashboardbuilder_routes.py
from flask import Blueprint, request, jsonify, current_app, send_file
from backend.extensions import db
from backend.models import Dashboard, Widget, User, Role
from functools import wraps
import os
import jwt
from datetime import datetime
import io, json, csv

dashboardbuilder_bp = Blueprint("dashboardbuilder_bp", __name__)

# ---------------------------
# JWT helpers
# ---------------------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Token can be in Authorization header 'Bearer <token>' or cookie
        auth_header = request.headers.get("Authorization", None)
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
        else:
            token = request.cookies.get("token", None)

        if not token:
            return jsonify({"status": "error", "message": "Token is missing"}), 401

        try:
            secret = os.environ.get("JWT_SECRET_KEY", current_app.config.get("JWT_SECRET_KEY", "dev-secret"))
            payload = jwt.decode(token, secret, algorithms=["HS256"])
            user_id = payload.get("sub")
            user = User.query.get(user_id)
            if not user:
                return jsonify({"status": "error", "message": "Invalid token user"}), 401
            # attach user to request context
            request.current_user = user
        except jwt.ExpiredSignatureError:
            return jsonify({"status": "error", "message": "Token expired"}), 401
        except Exception as e:
            return jsonify({"status": "error", "message": f"Token invalid: {str(e)}"}), 401

        return f(*args, **kwargs)
    return decorated

def role_allowed(user, allowed_roles):
    # user.roles is relationship -> list of Role
    user_roles = [r.name.lower() for r in user.roles]
    return any(r in user_roles for r in [ar.lower() for ar in allowed_roles])

# ---------------------------
# Role-based allowed widgets mapping
# ---------------------------
DEFAULT_ROLE_MAP = {
    "superadmin": ["temperature_chart", "pressure_chart", "humidity_chart", "table", "onoff", "gauge"],
    "admin": ["temperature_chart", "pressure_chart", "humidity_chart", "table", "gauge"],
    "tech": ["temperature_chart", "humidity_chart", "table", "gauge"],
    "user": ["pressure_chart", "table"],
}

# Endpoint: allowed widget types for current user
@dashboardbuilder_bp.route("/api/dashboardbuilder/allowed", methods=["GET"])
@token_required
def allowed_widget_types():
    user = request.current_user
    # find a role name (first role) if present
    role_names = [r.name.lower() for r in user.roles] if user.roles else []
    # decide allowed: union of role maps for all roles
    allowed = set()
    for rn in role_names:
        allowed.update(DEFAULT_ROLE_MAP.get(rn, []))
    # fallback: if no role, empty list
    return jsonify({"status": "success", "allowed": list(allowed)})

# List dashboards visible to this user (all users can view dashboards but we could restrict)
@dashboardbuilder_bp.route("/api/dashboardbuilder", methods=["GET"])
@token_required
def list_dashboards():
    user = request.current_user
    # superadmin can see all
    if role_allowed(user, ["superadmin"]):
        dashboards = Dashboard.query.order_by(Dashboard.updated_at.desc()).all()
    else:
        # show dashboards created_by user OR public ones (no created_by)
        dashboards = Dashboard.query.filter(
            (Dashboard.created_by == user.id) | (Dashboard.created_by == None)
        ).order_by(Dashboard.updated_at.desc()).all()

    return jsonify({"status": "success", "data": [d.to_dict() for d in dashboards]})

# Get single dashboard by id
@dashboardbuilder_bp.route("/api/dashboardbuilder/<int:dash_id>", methods=["GET"])
@token_required
def get_dashboard(dash_id):
    user = request.current_user
    d = Dashboard.query.get(dash_id)
    if not d:
        return jsonify({"status": "error", "message": "Dashboard not found"}), 404
    # permission: owner or superadmin or public
    if d.created_by and d.created_by != user.id and not role_allowed(user, ["superadmin"]):
        return jsonify({"status": "error", "message": "Not allowed"}), 403
    return jsonify({"status": "success", "data": d.to_dict()})

# Create new dashboard
@dashboardbuilder_bp.route("/api/dashboardbuilder", methods=["POST"])
@token_required
def create_dashboard():
    user = request.current_user
    payload = request.get_json() or {}
    name = payload.get("name")
    description = payload.get("description")
    layout = payload.get("layout", {})
    if not name:
        return jsonify({"status": "error", "message": "Name required"}), 400

    d = Dashboard(name=name, description=description, created_by=user.id, layout=layout)
    db.session.add(d)
    db.session.commit()
    return jsonify({"status": "success", "data": d.to_dict()}), 201

# Update dashboard (owner or superadmin)
@dashboardbuilder_bp.route("/api/dashboardbuilder/<int:dash_id>", methods=["PUT"])
@token_required
def update_dashboard(dash_id):
    user = request.current_user
    d = Dashboard.query.get(dash_id)
    if not d:
        return jsonify({"status": "error", "message": "Dashboard not found"}), 404
    if d.created_by and d.created_by != user.id and not role_allowed(user, ["superadmin"]):
        return jsonify({"status": "error", "message": "Not allowed"}), 403

    payload = request.get_json() or {}
    d.name = payload.get("name", d.name)
    d.description = payload.get("description", d.description)
    d.layout = payload.get("layout", d.layout)
    db.session.commit()
    return jsonify({"status": "success", "data": d.to_dict()})

# Delete dashboard (owner or superadmin)
@dashboardbuilder_bp.route("/api/dashboardbuilder/<int:dash_id>", methods=["DELETE"])
@token_required
def delete_dashboard(dash_id):
    user = request.current_user
    d = Dashboard.query.get(dash_id)
    if not d:
        return jsonify({"status": "error", "message": "Dashboard not found"}), 404
    if d.created_by and d.created_by != user.id and not role_allowed(user, ["superadmin"]):
        return jsonify({"status": "error", "message": "Not allowed"}), 403
    db.session.delete(d)
    db.session.commit()
    return jsonify({"status": "success", "message": "Deleted"})

# Download dashboard as JSON or CSV (single file download)
@dashboardbuilder_bp.route("/api/dashboardbuilder/<int:dash_id>/download", methods=["GET"])
@token_required
def download_dashboard(dash_id):
    fmt = request.args.get("format", "json").lower()
    d = Dashboard.query.get(dash_id)
    if not d:
        return jsonify({"status": "error", "message": "Dashboard not found"}), 404

    # ensure permission similar to get_dashboard
    user = request.current_user
    if d.created_by and d.created_by != user.id and not role_allowed(user, ["superadmin"]):
        return jsonify({"status": "error", "message": "Not allowed"}), 403

    data = d.to_dict()

    if fmt == "csv":
        # turn widgets into CSV rows
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["widget_id", "type", "title", "sensor", "device_id", "config"])
        for wid in d.layout.get("widgets", []):
            writer.writerow([
                wid.get("id"),
                wid.get("type"),
                wid.get("title"),
                wid.get("sensor"),
                wid.get("device_id"),
                json.dumps(wid.get("config", {}))
            ])
        output.seek(0)
        return send_file(io.BytesIO(output.getvalue().encode()), mimetype="text/csv", as_attachment=True, download_name=f"{d.name or 'dashboard'}_{dash_id}.csv")

    # default JSON
    out = json.dumps(data, indent=2)
    return send_file(io.BytesIO(out.encode("utf-8")), mimetype="application/json", as_attachment=True, download_name=f"{d.name or 'dashboard'}_{dash_id}.json")
