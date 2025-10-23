import os
import threading
import tempfile
import subprocess
import time
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from backend.extensions import db, socketio
from backend import models

# Lightweight cross-platform inter-process file lock
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


from flask_migrate import Migrate
from backend.models import *


def create_app():
    app = Flask(__name__)

    # ✅ Ensure instance folder exists
    instance_path = os.path.join(app.root_path, "instance")
    os.makedirs(instance_path, exist_ok=True)

    # ✅ SQLite DB path
    db_path = os.path.join(instance_path, "devices.db")

    # Database config
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", f"sqlite:///{db_path}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Enable CORS
    CORS(app)

    # Initialize extensions
    db.init_app(app)
    Migrate(app, db)
    socketio.init_app(app, cors_allowed_origins="*")

    # Register blueprints
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
    app.register_blueprint(user_bp, url_prefix="/api")
    app.register_blueprint(role_bp, url_prefix="/api/users")

    # ✅ Serve Frontend React Build (React Router friendly)
    FRONTEND_DIR = os.path.join(app.root_path, "../frontend/dist")

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_react(path):
        # Skip API routes
        if path.startswith("api/"):
            return jsonify({"error": "Invalid API route"}), 404

        # Serve static assets if they exist
        file_path = os.path.join(FRONTEND_DIR, path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return send_from_directory(FRONTEND_DIR, path)

        # Otherwise, serve index.html (React Router fallback)
        index_file = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index_file):
            return send_from_directory(FRONTEND_DIR, "index.html")

        return jsonify({"message": "✅ Franc Automation Backend Active"}), 200

    return app


app = create_app()


# --- Helper: Auto-migration ---
def auto_migrate():
    try:
        print("[MIGRATION] 🔍 Checking for new migrations...")
        subprocess.run(["flask", "db", "init"], check=False)
        subprocess.run(["flask", "db", "migrate", "-m", "auto migration"], check=False)
        subprocess.run(["flask", "db", "upgrade"], check=False)
        print("[MIGRATION] ✅ Database migration applied successfully!")
    except Exception as e:
        print(f"[MIGRATION] ⚠️ Auto-migration failed: {e}")


# --- MQTT Background Thread ---
def run_mqtt_thread():
    from mqtt_service import start_mqtt
    print("[MQTT] Starting background thread...")
    start_mqtt()
    print("[MQTT] Background thread running.")


os.environ["WERKZEUG_RUN_MAIN"] = "true"

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        print(
            "✅ Database ensured at:",
            os.path.join(app.root_path, "instance", "devices.db"),
        )
        auto_migrate()

    lock_path = os.path.join(tempfile.gettempdir(), "mqtt_init.lock")
    mqtt_lock = InterProcessLock(lock_path)

    if mqtt_lock.acquire(blocking=False):
        print("[INIT] MQTT starting once across all Flask reloads...")
        mqtt_thread = threading.Thread(target=run_mqtt_thread, daemon=True)
        mqtt_thread.start()
    else:
        print("[SKIP] MQTT already running in another process.")

    print("\n Franc Automation Backend + Frontend running at: http://127.0.0.1:5000\n")
    socketio.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
