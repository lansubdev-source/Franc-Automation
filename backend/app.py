# ==========================================================
# Franc Automation Backend Entry Point (Eventlet-Safe)
# ==========================================================
# NOTE:
#  - eventlet.monkey_patch() MUST run before importing ANY other stdlib/network/thread/db modules.
#  - We disable thread patching because threading.RLock() is used manually below.
# ==========================================================

import os
import warnings

# Suppress only eventlet warnings — not all runtime warnings globally
warnings.filterwarnings("ignore", message=".*monkey_patching.*")

# 🧩 Patch eventlet FIRST — before importing anything else
import eventlet
eventlet.monkey_patch(socket=True, select=True, time=True, os=True, thread=False)

# ----------------------------------------------------------
# Standard Library Imports (after patch)
# ----------------------------------------------------------
import threading
import tempfile
import subprocess
import time

# ----------------------------------------------------------
# Flask / App Imports (after eventlet patch)
# ----------------------------------------------------------
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate, init as migrate_init

from backend.extensions import db, socketio
from backend.utils.audit import log_info
from backend.models import *
from backend.mqtt_service import start_mqtt_client, stop_mqtt_client, init_mqtt_system

# Import seeding function (adds predefined users)
from backend.routes.auth_routes import seed_default_users

# ==========================================================
# Inter-process file lock for MQTT
# ==========================================================
try:
    import msvcrt  # Windows
except ImportError:
    import fcntl  # Unix


class InterProcessLock:
    def __init__(self, path):
        self.lockfile = os.path.abspath(path)
        self.fd = None

    def acquire(self, blocking=True, timeout=None):
        start = time.time()
        self.fd = open(self.lockfile, "w+")
        while True:
            try:
                if os.name == "nt":
                    msvcrt.locking(self.fd.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    fcntl.flock(self.fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return True
            except (BlockingIOError, IOError, OSError):
                if not blocking:
                    return False
                if timeout is not None and (time.time() - start) >= timeout:
                    return False
                time.sleep(0.1)

    def release(self):
        try:
            if self.fd:
                if os.name == "nt":
                    self.fd.seek(0)
                    msvcrt.locking(self.fd.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(self.fd, fcntl.LOCK_UN)
                self.fd.close()
                self.fd = None
                try:
                    os.remove(self.lockfile)
                except OSError:
                    pass
        except Exception:
            pass

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.release()


# ==========================================================
# Flask App Factory
# ==========================================================
def create_app():
    app = Flask(__name__)

    # Instance folder for SQLite DB
    instance_path = os.path.join(app.root_path, "instance")
    os.makedirs(instance_path, exist_ok=True)
    db_path = os.path.join(instance_path, "app.db")

    # Database config
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", f"sqlite:///{db_path}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # CORS + Extensions
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    db.init_app(app)
    Migrate(app, db)

    socketio.init_app(app, cors_allowed_origins="*", async_mode="eventlet")

    # ==========================================================
    # Ensure migrations folder exists
    # ==========================================================
    migrations_path = os.path.join(app.root_path, "migrations")
    if not os.path.exists(migrations_path):
        with app.app_context():
            try:
                migrate_init()
                log_info("[MIGRATION] Initialized new migrations folder.")
            except Exception:
                pass

    # ==========================================================
    # Register Blueprints
    # ==========================================================
    from backend.routes.device_routes import device_bp
    from backend.routes.data_routes import data_bp
    from backend.routes.auth_routes import auth_bp
    from backend.routes.settings_routes import settings_bp
    from backend.routes.sensor_routes import sensor_bp
    from backend.routes.user_routes import user_bp
    from backend.routes.role_routes import role_bp
    from backend.routes.dashboard_routes import dashboard_bp
    from backend.routes.history_routes import history_bp
    from backend.routes.dashboardbuilder_routes import dashboardbuilder_bp
    from backend.routes.dashboards_routes import dashboards_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(device_bp, url_prefix="/api")
    app.register_blueprint(data_bp, url_prefix="/api")
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(sensor_bp, url_prefix="/api")
    app.register_blueprint(user_bp, url_prefix="/api/users")
    app.register_blueprint(role_bp, url_prefix="/api/users")
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(history_bp, url_prefix="/api/history")
    app.register_blueprint(dashboards_bp, url_prefix="/api/dashboards")
    app.register_blueprint(dashboardbuilder_bp, url_prefix="/api/dashboardbuilder")


        # ==========================================================
    # Database Download Route (requested by sir)
    # ==========================================================
    @app.route("/download-db", methods=["GET"])
    def download_db():
        # Path to SQLite DB inside instance folder
        instance_folder = os.path.join(app.root_path, "instance")
        db_file = os.path.join(instance_folder, "app.db")

        # IF condition your sir mentioned
        if os.path.exists(db_file):
            # Send database file to download
            return send_from_directory(
                directory=instance_folder,
                path="app.db",
                as_attachment=True
            )
        else:
            # If DB file missing
            return jsonify({"error": "Database file not found"}), 404

    # ==========================================================
    # Serve React Frontend Build (production)
    # ==========================================================
    FRONTEND_DIR = os.path.join(app.root_path, "../frontend/dist")

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_react(path):
        if path.startswith("api/"):
            return jsonify({"error": "Invalid API route"}), 404
        file_path = os.path.join(FRONTEND_DIR, path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return send_from_directory(FRONTEND_DIR, path)
        index_file = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index_file):
            return send_from_directory(FRONTEND_DIR, "index.html")
        return jsonify({"message": "✅ Franc Automation Backend Active"}), 200

    return app

# ==========================================================
# Auto-Migration Helper
# ==========================================================
def auto_migrate():
    """Automatically initialize and apply migrations for SQLite"""
    try:
        log_info("[MIGRATION] Checking migrations...")
        if not os.path.exists(os.path.join(os.path.dirname(__file__), "migrations")):
            subprocess.run(["flask", "db", "init"], check=False)
        subprocess.run(["flask", "db", "migrate", "-m", "auto migration"], check=False)
        subprocess.run(["flask", "db", "upgrade"], check=False)
        log_info("[MIGRATION] ✅ Database migration successful!")
    except Exception as e:
        log_info(f"[MIGRATION] ⚠️ Auto-migration failed: {e}")


# ==========================================================
# MQTT Initialization (Manual Only)
# ==========================================================
def run_mqtt_thread(app):
    """Only prepares context; no auto device connection"""
    with app.app_context():
        log_info("[MQTT] Thread ready — devices must be connected manually via API.")


# ==========================================================
# Main Entry
# ==========================================================
if __name__ == "__main__":
    import eventlet.wsgi

    app = create_app()

    with app.app_context():
        auto_migrate()

        # ⭐ NEW: Seed login accounts (superadmin/admin/users)
        try:
            seed_default_users()
            log_info("[SEED] Default users seeded (if missing).")
        except Exception as e:
            log_info(f"[SEED] Warning: seeding default users failed: {e}")

        init_mqtt_system()

    # Prevent duplicate MQTT threads
    lock_path = os.path.join(tempfile.gettempdir(), "mqtt_init.lock")
    mqtt_lock = InterProcessLock(lock_path)

    if mqtt_lock.acquire(blocking=False):
        log_info("[INIT] MQTT thread started (manual mode, no auto-connect)...")
        mqtt_thread = threading.Thread(target=run_mqtt_thread, args=(app,), daemon=True)
        mqtt_thread.start()
    else:
        log_info("[SKIP] MQTT thread already active in another process.")

    log_info("🚀 Franc Automation Backend + Frontend running with Eventlet at http://0.0.0.0:5000")

    # Use eventlet’s WSGI server
    eventlet.wsgi.server(
        eventlet.listen(("0.0.0.0", int(os.environ.get("PORT", 5000)))),
        app,
    )
