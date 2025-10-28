# ==========================================================
# Must patch BEFORE any Flask/threading/db imports
# ==========================================================
import eventlet
eventlet.monkey_patch()

import os
import threading
import tempfile
import subprocess
import time
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate
from backend.extensions import db, socketio
from backend.utils.audit import log_info
from backend.models import *
from backend.mqtt_service import start_device_mqtt

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
    db_path = os.path.join(instance_path, "devices.db")

    # Database config
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", f"sqlite:///{db_path}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # CORS + Extensions
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    db.init_app(app)
    Migrate(app, db)

    # ✅ Use Eventlet for async socket handling
    socketio.init_app(app, cors_allowed_origins="*", async_mode="eventlet")

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

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(device_bp, url_prefix="/api")
    app.register_blueprint(data_bp, url_prefix="/api")
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(sensor_bp, url_prefix="/api")
    app.register_blueprint(user_bp, url_prefix="/api/users")
    app.register_blueprint(role_bp, url_prefix="/api/users")

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
    try:
        log_info("[MIGRATION] Checking migrations...")
        subprocess.run(["flask", "db", "migrate", "-m", "auto migration"], check=False)
        subprocess.run(["flask", "db", "upgrade"], check=False)
        log_info("[MIGRATION] ✅ Database migration successful!")
    except Exception as e:
        log_info(f"[MIGRATION] ⚠️ Auto-migration failed: {e}")


# ==========================================================
# MQTT Initialization for All Devices
# ==========================================================
def start_all_devices(app):
    with app.app_context():
        from backend.models import Device
        devices = Device.query.all()
        if not devices:
            log_info("[MQTT] ⚠️ No devices found in database.")
            return
        for d in devices:
            try:
                start_device_mqtt(d)
                log_info(f"[MQTT] 🔄 Reconnected device '{d.name}' ({d.host}:{d.port})")
            except Exception as e:
                log_info(f"[MQTT] ⚠️ Failed to start device '{d.name}': {e}")


# ==========================================================
# Background Thread for MQTT
# ==========================================================
def run_mqtt_thread(app):
    with app.app_context():
        log_info("[MQTT] Starting dynamic MQTT connections for all devices...")
        start_all_devices(app)
        log_info("[MQTT] All device MQTT clients started.")


# ==========================================================
# Main Entry
# ==========================================================
if __name__ == "__main__":
    import eventlet
    import eventlet.wsgi

    app = create_app()

    with app.app_context():
        auto_migrate()

    lock_path = os.path.join(tempfile.gettempdir(), "mqtt_init.lock")
    mqtt_lock = InterProcessLock(lock_path)

    if mqtt_lock.acquire(blocking=False):
        log_info("[INIT] MQTT thread starting globally for all devices...")
        mqtt_thread = threading.Thread(target=run_mqtt_thread, args=(app,), daemon=True)
        mqtt_thread.start()
    else:
        log_info("[SKIP] MQTT already running in another process.")

    log_info("🚀 Franc Automation Backend + Frontend running with Eventlet at http://0.0.0.0:5000")

    # ✅ Use Eventlet WSGI server instead of Werkzeug
    eventlet.monkey_patch()
    socketio.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False,
        use_reloader=False,
    )
