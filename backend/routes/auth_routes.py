from flask import Blueprint, request, jsonify, current_app
from backend.models import db, User
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from datetime import datetime, timedelta

auth_bp = Blueprint("auth", __name__)

# ---------------------------------------
# REGISTER
# ---------------------------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "user").strip()

    if not username or not password:
        return jsonify({"message": "Username and password required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Username already exists"}), 400

    try:
        user = User(
            username=username,
            password_hash=generate_password_hash(password),
            role=role
        )
        db.session.add(user)
        db.session.commit()

        return jsonify({
            "message": "User registered",
            "user": user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error creating user", "error": str(e)}), 500


# ---------------------------------------
# LOGIN → ISSUE JWT
# ---------------------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username", "")
    password = data.get("password", "")

    user = User.query.filter_by(username=username).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"message": "Invalid username or password"}), 401

    payload = {
        "sub": user.id,             # IMPORTANT: user.id not username
        "role": user.role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=10)
    }

    token = jwt.encode(
        payload,
        current_app.config["JWT_SECRET_KEY"],
        algorithm="HS256"
    )

    return jsonify({
        "access_token": token,
        "user": user.to_dict(),
        "message": "Login successful"
    })


# ---------------------------------------
# PROFILE
# ---------------------------------------
@auth_bp.route("/me", methods=["GET"])
def me():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return jsonify({"message": "Missing token"}), 401

    token = auth.split(" ", 1)[1]

    try:
        decoded = jwt.decode(
            token,
            current_app.config["JWT_SECRET_KEY"],
            algorithms=["HS256"]
        )

        user = User.query.get(decoded.get("sub"))

        if not user:
            return jsonify({"message": "User not found"}), 404

        return jsonify({
            "user": user.to_dict(),
            "message": "Token valid"
        })

    except jwt.ExpiredSignatureError:
        return jsonify({"message": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"message": "Invalid token"}), 401
    except Exception as e:
        return jsonify({"message": "Error decoding token", "error": str(e)}), 500
