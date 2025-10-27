# backend/scripts/seed_permissions_users.py
from backend.app import create_app, db
from backend.models import Role, Permission, User
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    print("🚀 Starting role, permission, and user seeding...")

    # === Define roles and permissions ===
    roles_data = {
        "Admin": [
            "view_dashboard",
            "manage_devices",
            "manage_users",
            "view_reports",
            "configure_settings",
        ],
        "Manager": [
            "view_dashboard",
            "view_reports",
            "manage_devices",
        ],
        "Technician": [
            "view_dashboard",
            "manage_devices",
        ],
        "Viewer": [
            "view_dashboard",
        ],
    }

    # === Create permissions ===
    for role, perms in roles_data.items():
        for perm_name in perms:
            if not Permission.query.filter_by(name=perm_name).first():
                db.session.add(Permission(name=perm_name))
    db.session.commit()

    # === Create roles and link permissions ===
    for role_name, perm_names in roles_data.items():
        role = Role.query.filter_by(name=role_name).first()
        if not role:
            role = Role(name=role_name)
            db.session.add(role)
            db.session.commit()
            print(f"✅ Role created: {role_name}")

        for perm_name in perm_names:
            perm = Permission.query.filter_by(name=perm_name).first()
            if perm not in role.permissions:
                role.permissions.append(perm)
        db.session.commit()

    # === Create a default superadmin user ===
    superadmin_email = "admin@francautomation.com"
    superadmin = User.query.filter_by(email=superadmin_email).first()

    if not superadmin:
        superadmin = User(
            username="superadmin",
            email=superadmin_email,
            password=generate_password_hash("admin123"),
            is_active=True,
            image_url="/default-user.png",
        )
        db.session.add(superadmin)
        db.session.commit()
        print("👑 Superadmin created successfully.")
    else:
        print("ℹ️ Superadmin already exists, updating roles...")

    # Assign all roles to superadmin
    all_roles = Role.query.all()
    for role in all_roles:
        if role not in superadmin.roles:
            superadmin.roles.append(role)
    db.session.commit()

    print("✅ Superadmin assigned to all roles.")
    print("🎉 Seeding complete.")
