# backend/routes/user_routes.py

from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from backend.extensions import db, socketio
from backend.models import User, Role, Device
from backend.utils.audit import log_info, emit_event

user_bp = Blueprint("users", __name__)

# --------------------------
# 📘 Get all users
# --------------------------
@user_bp.route("/users/all", methods=["GET"])
def get_all_users():
    users = User.query.all()
    result = []
    for u in users:
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "friendly_name": getattr(u, "friendly_name", None),
            "image_url": getattr(u, "image_url", None),
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "roles": [{"id": r.id, "name": r.name} for r in u.roles],
            "permissions": [{"id": p.id, "name": p.name} for p in getattr(u, "permissions", [])],
            "devices": [{"id": d.id, "name": d.name} for d in u.devices]
        })
    log_info(f"Fetched all users ({len(result)} users)")
    emit_event("users_fetched", {"count": len(result)})
    return jsonify({"users": result}), 200

# --------------------------
# 📗 Get available roles
# --------------------------
@user_bp.route("/users/roles", methods=["GET"])
def get_roles():
    roles = Role.query.all()
    result = [{"id": r.id, "name": r.name} for r in roles]
    log_info(f"Fetched all roles ({len(result)} roles)")
    emit_event("roles_fetched", {"count": len(result)})
    return jsonify({"roles": result}), 200

# --------------------------
# 📘 Register new user
# --------------------------
@user_bp.route("/users/register", methods=["POST"])
def register_user():
    username = request.form.get("username") or request.json.get("username")
    email = request.form.get("email") or request.json.get("email")
    password = request.form.get("password") or request.json.get("password")
    image_url = request.form.get("image_url") or request.json.get("image_url")
    is_active = (request.form.get("is_active") or request.json.get("is_active", "true")).lower() == "true"

    if not all([username, email, password]):
        return jsonify({"error": "Missing required fields"}), 400

    if User.query.filter((User.username==username)|(User.email==email)).first():
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

    log_info(f"User registered: {username} (id={new_user.id})")
    emit_event("user_registered", {
        "id": new_user.id,
        "username": new_user.username,
        "email": new_user.email,
        "is_active": new_user.is_active
    })

    return jsonify({"message": "User registered successfully", "id": new_user.id}), 201

# --------------------------
# 📘 Login user
# --------------------------
@user_bp.route("/users/login", methods=["POST"])
def login_user():
    email = request.form.get("email") or request.json.get("email")
    password = request.form.get("password") or request.json.get("password")

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password, password):
        log_info(f"Failed login attempt: {email}")
        emit_event("user_login_failed", {"email": email})
        return jsonify({"error": "Invalid credentials"}), 401

    log_info(f"User logged in: {user.username} (id={user.id})")
    emit_event("user_logged_in", {"id": user.id, "username": user.username, "email": user.email})
    return jsonify({"message": "Login successful", "user": {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active
    }}), 200

# --------------------------
# 📙 Update existing user
# --------------------------
@user_bp.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    username = request.form.get("username") or request.json.get("username")
    email = request.form.get("email") or request.json.get("email")
    password = request.form.get("password") or request.json.get("password")
    image_url = request.form.get("image_url") or request.json.get("image_url")
    is_active = request.form.get("is_active") or request.json.get("is_active")

    if username: user.username = username
    if email: user.email = email
    if image_url: user.image_url = image_url
    if is_active: user.is_active = is_active.lower() == "true"
    if password: user.password = generate_password_hash(password)

    db.session.commit()
    log_info(f"User updated: {user.username} (id={user.id})")
    emit_event("user_updated", {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active
    })
    return jsonify({"message": "User updated successfully"}), 200

# --------------------------
# 📕 Delete a user
# --------------------------
@user_bp.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    db.session.delete(user)
    db.session.commit()
    log_info(f"User deleted: {user.username} (id={user.id})")
    emit_event("user_deleted", {"id": user.id, "username": user.username})
    return jsonify({"message": "User deleted successfully"}), 200
# --------------------------
# 📘 Get all permissions
# --------------------------
@user_bp.route("/users/permissions", methods=["GET"])
def get_all_permissions():
    from backend.models import Permission

    permissions = Permission.query.all()
    result = []
    for p in permissions:
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description
        })
    return jsonify(result), 200
