# backend/scripts/seed_roles_permissions.py
from app import create_app, db
from models import Role, Permission

app = create_app()

with app.app_context():
    default_roles = ["Admin", "Manager", "Technician", "Viewer"]
    default_permissions = [
        "view_dashboard",
        "manage_devices",
        "manage_users",
        "view_reports"
    ]

    # Create roles
    for role_name in default_roles:
        if not Role.query.filter_by(name=role_name).first():
            db.session.add(Role(name=role_name))

    # Create permissions
    for perm_name in default_permissions:
        if not Permission.query.filter_by(name=perm_name).first():
            db.session.add(Permission(name=perm_name))

    db.session.commit()  # commit roles and permissions

    # Assign default permissions to roles
    role_perm_map = {
        "Admin": ["view_dashboard", "manage_devices", "manage_users", "view_reports"],
        "Manager": ["view_dashboard", "manage_devices", "view_reports"],
        "Technician": ["view_dashboard", "manage_devices"],
        "Viewer": ["view_dashboard"]
    }

    for role_name, perm_names in role_perm_map.items():
        role = Role.query.filter_by(name=role_name).first()
        for perm_name in perm_names:
            perm = Permission.query.filter_by(name=perm_name).first()
            if perm not in role.permissions:
                role.permissions.append(perm)

    db.session.commit()
    print("✅ Roles, permissions, and role-permission assignments seeded successfully!")
