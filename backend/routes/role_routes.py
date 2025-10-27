from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError
from backend.extensions import db
from backend.models import Role, Permission

role_bp = Blueprint("role_bp", __name__, url_prefix="/api/users")

# ---- Get all Roles ----
@role_bp.route("/roles", methods=["GET"])
def get_roles():
    try:
        roles = Role.query.all()
        data = []
        for r in roles:
            data.append({
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "permissions": [p.id for p in r.permissions]
            })
        return jsonify({"data": data}), 200
    except SQLAlchemyError as e:
        return jsonify({"message": str(e)}), 500


# ---- Get all Permissions ----
@role_bp.route("/permissions", methods=["GET"])
def get_permissions():
    try:
        permissions = Permission.query.all()
        data = [
            {"id": p.id, "name": p.name, "description": p.description}
            for p in permissions
        ]
        return jsonify({"data": data}), 200
    except SQLAlchemyError as e:
        return jsonify({"message": str(e)}), 500

# ---- Add Role ----
@role_bp.route("/roles", methods=["POST"])
def add_role():
    data = request.get_json()
    if not data.get("name"):
        return jsonify({"message": "Role name required"}), 400

    try:
        if Role.query.filter_by(name=data["name"]).first():
            return jsonify({"message": "Role already exists"}), 400

        new_role = Role(name=data["name"], description=data.get("description", ""))
        db.session.add(new_role)
        db.session.commit()
        return jsonify({
            "data": {"id": new_role.id, "name": new_role.name, "description": new_role.description}
        }), 201
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 500

# ---- Add Permission ----
@role_bp.route("/permissions", methods=["POST"])
def add_permission():
    data = request.get_json()
    if not data.get("name"):
        return jsonify({"message": "Permission name required"}), 400

    try:
        if Permission.query.filter_by(name=data["name"]).first():
            return jsonify({"message": "Permission already exists"}), 400

        new_perm = Permission(name=data["name"], description=data.get("description", ""))
        db.session.add(new_perm)
        db.session.commit()
        return jsonify({
            "data": {"id": new_perm.id, "name": new_perm.name, "description": new_perm.description}
        }), 201
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 500

# ---- Assign Permission to Role ----
@role_bp.route("/assign-role-permission", methods=["POST"])
def assign_role_permission():
    data = request.get_json()
    role_id = data.get("role_id")
    perm_id = data.get("permission_id")

    if not role_id or not perm_id:
        return jsonify({"message": "role_id and permission_id are required"}), 400

    try:
        role = Role.query.get(role_id)
        perm = Permission.query.get(perm_id)

        if not role or not perm:
            return jsonify({"message": "Invalid role or permission ID"}), 404

        if perm not in role.permissions:
            role.permissions.append(perm)
            db.session.commit()

        return jsonify({
            "message": f"Permission '{perm.name}' assigned to role '{role.name}'"
        }), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 500
