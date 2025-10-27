from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from backend.extensions import db
from backend.models import User, Role, Permission
from backend.utils.audit import log_info, emit_event

user_bp = Blueprint("users", __name__)

# ==========================================================
# 📘 Get all users
# ==========================================================
@user_bp.route("/all", methods=["GET"])
@user_bp.route("/list", methods=["GET"])  # alias for frontend
def get_all_users():
    users = User.query.all()
    result = [u.to_dict() for u in users]

    log_info(f"📋 Retrieved {len(result)} users from database.")
    emit_event("users_fetched", {"count": len(result)})

    return jsonify({"users": result}), 200


# ==========================================================
# 📗 Get all roles (✅ fixed key to 'data')
# ==========================================================
@user_bp.route("/roles", methods=["GET"])
def get_roles():
    roles = Role.query.all()
    result = [{"id": r.id, "name": r.name} for r in roles]

    log_info(f"📘 Roles fetched: {len(result)} available.")
    emit_event("roles_fetched", {"count": len(result)})

    # ✅ return "data" instead of "roles"
    return jsonify({"data": result}), 200


# ==========================================================
# 🧩 Get all permissions (✅ fixed key to 'data')
# ==========================================================
@user_bp.route("/permissions", methods=["GET"])
def get_permissions():
    permissions = Permission.query.all()
    result = [{"id": p.id, "name": p.name, "description": p.description} for p in permissions]

    log_info(f"🔑 Permissions fetched: {len(result)} found.")
    emit_event("permissions_fetched", {"count": len(result)})

    # ✅ return "data" instead of "permissions"
    return jsonify({"data": result}), 200


# ==========================================================
# 🧍 Register new user
# ==========================================================
@user_bp.route("/register", methods=["POST"])
def register_user():
    try:
        data = request.get_json() or request.form

        username = data.get("username")
        email = data.get("email")
        password = data.get("password")
        image_url = data.get("image_url", "")
        is_active_val = data.get("is_active", True)
        is_active = str(is_active_val).lower() == "true"

        if not all([username, email, password]):
            return jsonify({"error": "Missing required fields"}), 400

        if User.query.filter((User.username == username) | (User.email == email)).first():
            return jsonify({"error": "User with same username/email exists"}), 400

        hashed_password = generate_password_hash(password)
        new_user = User(
            username=username,
            email=email,
            password=hashed_password,
            image_url=image_url,
            is_active=is_active,
        )
        db.session.add(new_user)
        db.session.commit()

        user_dict = new_user.to_dict()

        log_info(f"✅ User created → {username} | {email} | ID={new_user.id}")
        emit_event("user_registered", user_dict)

        return jsonify({"message": "User registered successfully", "user": user_dict}), 201

    except Exception as e:
        log_info(f"❌ Error registering user: {e}")
        return jsonify({"error": "Server error during user registration"}), 500


# ==========================================================
# 🔐 Login user
# ==========================================================
@user_bp.route("/login", methods=["POST"])
def login_user():
    data = request.get_json() or request.form
    email = data.get("email")
    password = data.get("password")

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password, password):
        log_info(f"❌ Login failed for {email}")
        emit_event("user_login_failed", {"email": email})
        return jsonify({"error": "Invalid credentials"}), 401

    log_info(f"🔓 User logged in: {user.username} (ID: {user.id})")
    emit_event("user_logged_in", {"id": user.id, "username": user.username})

    return jsonify({
        "message": "Login successful",
        "user": user.to_dict()
    }), 200


# ==========================================================
# 📝 Update user
# ==========================================================
@user_bp.route("/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or request.form

    if "username" in data:
        user.username = data["username"]
    if "email" in data:
        user.email = data["email"]
    if "image_url" in data:
        user.image_url = data["image_url"]
    if "is_active" in data:
        user.is_active = str(data["is_active"]).lower() == "true"
    if "password" in data and data["password"]:
        user.password = generate_password_hash(data["password"])

    db.session.commit()

    updated_user = user.to_dict()
    log_info(f"📝 User updated → {user.username} | ID={user.id}")
    emit_event("user_updated", updated_user)

    return jsonify({"message": "User updated successfully", "user": updated_user}), 200


# ==========================================================
# 🗑️ Delete user
# ==========================================================
@user_bp.route("/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    db.session.delete(user)
    db.session.commit()

    log_info(f"🗑️ User deleted → {user.username} | ID={user.id}")
    emit_event("user_deleted", {"id": user.id, "username": user.username})

    return jsonify({"message": "User deleted successfully"}), 200
