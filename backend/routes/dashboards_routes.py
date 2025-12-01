from flask import Blueprint, request, jsonify
from backend.models import db, Dashboard, DashboardWidget, User
from functools import wraps

dashboards_bp = Blueprint("dashboards", __name__, url_prefix="/api")


# ---------------------------------------------------
# Helper: Get user using ?user=username (DEV MODE)
# ---------------------------------------------------
def get_current_user():
    username = request.args.get("user")

    if not username:
        return None

    return User.query.filter_by(username=username).first()


def require_user(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({
                "status": "error",
                "message": "No user found. Use ?user=superadmin or ?user=admin etc."
            }), 401
        return f(user, *args, **kwargs)
    return wrapper


# ---------------------------------------------------
# 1️⃣ GET ALL DASHBOARDS
# GET /api/dashboards
# ---------------------------------------------------
@dashboards_bp.route("/dashboards", methods=["GET"])
@require_user
def list_dashboards(current_user):

    role = current_user.roles[0].name if current_user.roles else "user"

    # Superadmin sees ALL
    if role == "superadmin":
        dashboards = Dashboard.query.order_by(Dashboard.created_at.desc()).all()

    # Admin sees ALL dashboards (your requirement)
    elif role == "admin":
        dashboards = Dashboard.query.order_by(Dashboard.created_at.desc()).all()

    # Normal user sees ONLY their own
    else:
        dashboards = Dashboard.query.filter_by(owner_id=current_user.id).order_by(Dashboard.created_at.desc()).all()

    return jsonify({
        "status": "success",
        "dashboards": [d.to_dict() for d in dashboards]
    })


# ---------------------------------------------------
# 2️⃣ GET ONE DASHBOARD
# GET /api/dashboards/<id>
# ---------------------------------------------------
@dashboards_bp.route("/dashboards/<int:dash_id>", methods=["GET"])
@require_user
def get_dashboard(current_user, dash_id):

    dash = Dashboard.query.get_or_404(dash_id)

    role = current_user.roles[0].name if current_user.roles else "user"

    # Restrict access
    if role not in ("superadmin", "admin") and dash.owner_id != current_user.id:
        return jsonify({
            "status": "error",
            "message": "Forbidden"
        }), 403

    return jsonify({
        "status": "success",
        "dashboard": dash.to_dict()
    })


# ---------------------------------------------------
# 3️⃣ DELETE DASHBOARD
# DELETE /api/dashboards/<id>
# ---------------------------------------------------
@dashboards_bp.route("/dashboards/<int:dash_id>", methods=["DELETE"])
@require_user
def delete_dashboard(current_user, dash_id):

    dash = Dashboard.query.get_or_404(dash_id)

    role = current_user.roles[0].name if current_user.roles else "user"

    # DELETE rules
    if role not in ("superadmin", "admin") and dash.owner_id != current_user.id:
        return jsonify({
            "status": "error",
            "message": "Not allowed to delete this dashboard"
        }), 403

    # Delete dashboard + widgets
    db.session.delete(dash)
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Dashboard deleted"
    })
