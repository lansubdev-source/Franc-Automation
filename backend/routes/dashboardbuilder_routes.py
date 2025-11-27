from flask import Blueprint, request, jsonify
from backend.models import db, Dashboard, DashboardWidget, User, Device
from functools import wraps

dashboard_bp = Blueprint("dashboardbuilder", __name__, url_prefix="/api")

# -----------------------------------------
# Helper: get current user from header (?user= for dev fallback)
# -----------------------------------------
def get_current_user_from_request():
    username = request.args.get("user")  # DEV fallback
    if username:
        return User.query.filter_by(username=username).first()
    return None


def require_user(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = get_current_user_from_request()
        if not user:
            return jsonify({
                "status": "error",
                "message": "No user found. Use ?user=superadmin for testing."
            }), 401
        return f(user, *args, **kwargs)
    return wrapper


# -----------------------------------------
# ROLE → ALLOWED WIDGET TYPES
# -----------------------------------------
def allowed_widgets_for_role(role_name: str):
    if role_name in ("superadmin", "admin"):
        return [
            "line",
            "gauge",
            "pressure_chart",
            "temperature_chart",
            "humidity_chart",
            "table",
            "onoff"
        ]
    if role_name == "user1":
        return ["temperature_chart"]
    if role_name == "user2":
        return ["humidity_chart"]
    if role_name == "user3":
        return ["pressure_chart"]
    if role_name == "user4":
        return ["temperature_chart", "pressure_chart"]
    return []  # user5 → user10


# ================================================================
# USERS DROPDOWN  → /api/users
# ================================================================
@dashboard_bp.route("/users", methods=["GET"])
@require_user
def list_users(current_user):
    users = User.query.order_by(User.username).all()
    output = []
    for u in users:
        role = u.roles[0].name if u.roles else "user"
        output.append({
            "id": u.id,
            "username": u.username,
            "role": role
        })
    return jsonify(output)


# ================================================================
# DEVICES DROPDOWN → /api/devices
# ================================================================
@dashboard_bp.route("/devices", methods=["GET"])
@require_user
def list_devices(current_user):
    devices = Device.query.order_by(Device.name).all()
    return jsonify([
        {"id": d.id, "name": d.name}
        for d in devices
    ])


# ================================================================
# SENSORS DROPDOWN → STATIC VALUES (Your Requirement)
# ================================================================
@dashboard_bp.route("/sensors", methods=["GET"])
@require_user
def list_sensors(current_user):
    """
    You requested: sensors dropdown must ONLY show:
      - temperature
      - humidity
      - pressure
    """

    static_sensors = [
        {"id": 1, "topic": "temperature"},
        {"id": 2, "topic": "humidity"},
        {"id": 3, "topic": "pressure"},
    ]
    return jsonify(static_sensors)


# ================================================================
# CREATE DASHBOARD → /api/dashboards
# ================================================================
@dashboard_bp.route("/dashboards", methods=["POST"])
@require_user
def create_dashboard(current_user):

    data = request.get_json() or {}

    name = data.get("name")
    description = data.get("description", "")
    owner_user_id = data.get("owner_user_id")  # <== NOW OPTIONAL
    widgets = data.get("widgets", [])

    # ------------------------------------------
    # If assign user is not selected → use current user
    # ------------------------------------------
    if not owner_user_id:
        owner_user_id = current_user.id

    if not name:
        return jsonify({"status": "error", "message": "Name is required"}), 400

    owner = User.query.get(owner_user_id)
    if not owner:
        return jsonify({"status": "error", "message": "Owner not found"}), 400

    # Determine allowed widget types based on owner's role
    owner_role = owner.roles[0].name if owner.roles else "user"
    allowed_widget_types = allowed_widgets_for_role(owner_role)

    # Validate each widget type
    for w in widgets:
        wtype = w.get("type")
        if wtype not in allowed_widget_types:
            return jsonify({
                "status": "error",
                "message": f"Widget '{wtype}' not allowed for role '{owner_role}'"
            }), 403

    # Create dashboard
    dashboard = Dashboard(
        name=name,
        description=description,
        owner_id=owner_user_id
    )
    db.session.add(dashboard)
    db.session.flush()

    # Create widgets
    for w in widgets:
        widget = DashboardWidget(
            dashboard_id=dashboard.id,
            widget_type=w.get("type"),
            title=w.get("title"),
            device_id=w.get("device_id"),
            sensor=str(w.get("sensor_id") or ""),
            config=w.get("config", {})
        )
        db.session.add(widget)

    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Dashboard created",
        "dashboard": dashboard.to_dict()
    })


# ================================================================
# LIST DASHBOARDS → /api/dashboards
# ================================================================
@dashboard_bp.route("/dashboards", methods=["GET"])
@require_user
def list_dashboards(current_user):
    role = current_user.roles[0].name if current_user.roles else "user"

    if role in ("superadmin", "admin"):
        dashboards = Dashboard.query.all()
    else:
        dashboards = Dashboard.query.filter_by(owner_id=current_user.id).all()

    return jsonify([d.to_dict() for d in dashboards])


# ================================================================
# GET ONE DASHBOARD → /api/dashboards/<id>
# ================================================================
@dashboard_bp.route("/dashboards/<int:dash_id>", methods=["GET"])
@require_user
def get_dashboard(current_user, dash_id):
    dash = Dashboard.query.get_or_404(dash_id)

    role = current_user.roles[0].name if current_user.roles else "user"

    if role not in ("superadmin", "admin") and dash.owner_id != current_user.id:
        return jsonify({"status": "error", "message": "Forbidden"}), 403

    return jsonify(dash.to_dict())
