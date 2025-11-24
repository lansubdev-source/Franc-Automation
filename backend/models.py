# ==========================================================
# backend/models.py — Unified ORM Models (Users + Devices + Sensors)
# ==========================================================
from datetime import datetime
from backend.extensions import db
from pytz import timezone
from sqlalchemy import JSON

# ==========================================================
# Association Tables
# ==========================================================
role_permissions = db.Table(
    "role_permissions",
    db.metadata,
    db.Column("role_id", db.Integer, db.ForeignKey("roles.id"), primary_key=True),
    db.Column("permission_id", db.Integer, db.ForeignKey("permissions.id"), primary_key=True),
    extend_existing=True,
)

user_roles = db.Table(
    "user_roles",
    db.metadata,
    db.Column("user_id", db.Integer, db.ForeignKey("users.id"), primary_key=True),
    db.Column("role_id", db.Integer, db.ForeignKey("roles.id"), primary_key=True),
    extend_existing=True,
)

user_devices = db.Table(
    "user_devices",
    db.metadata,
    db.Column("user_id", db.Integer, db.ForeignKey("users.id"), primary_key=True),
    db.Column("device_id", db.Integer, db.ForeignKey("devices.id"), primary_key=True),
    extend_existing=True,
)

# ==========================================================
# User Model
# ==========================================================
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    image_url = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    roles = db.relationship("Role", secondary=user_roles, backref="users")
    devices = db.relationship("Device", secondary=user_devices, backref="users")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "roles": [r.name for r in self.roles],
            "devices": [d.name for d in self.devices],
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }

# ==========================================================
# Role Model
# ==========================================================
class Role(db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    permissions = db.relationship(
        "Permission",
        secondary=role_permissions,
        backref=db.backref("roles", lazy="dynamic"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "permissions": [p.name for p in self.permissions],
            "created_at": self.created_at.isoformat(),
        }

# ==========================================================
# Permission Model
# ==========================================================
class Permission(db.Model):
    __tablename__ = "permissions"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.String(255))

    def to_dict(self):
        return {"id": self.id, "name": self.name, "description": self.description}

# ==========================================================
# Device Model
# ==========================================================
class Device(db.Model):
    __tablename__ = "devices"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    broker_url = db.Column(db.String(255), default="broker.hivemq.com")
    protocol = db.Column(db.String(20))
    host = db.Column(db.String(120))
    port = db.Column(db.Integer, default=1883)
    client_id = db.Column(db.String(120))
    username = db.Column(db.String(120))
    password = db.Column(db.String(120))
    mqtt_version = db.Column(db.String(20))
    keep_alive = db.Column(db.Integer)
    auto_reconnect = db.Column(db.Boolean)
    reconnect_period = db.Column(db.Integer)
    status = db.Column(db.String(20), default="offline")
    enable_tls = db.Column(db.Boolean, default=False)
    is_connected = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_seen = db.Column(db.DateTime, nullable=True)

    # 🔗 Relationship to sensors
    sensors = db.relationship("Sensor", back_populates="device", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "broker_url": self.broker_url,
            "status": self.status,
            "is_connected": self.is_connected,
            "protocol": self.protocol,
            "host": self.host,
            "port": self.port,
            "client_id": self.client_id,
            "username": self.username,
            "mqtt_version": self.mqtt_version,
            "keep_alive": self.keep_alive,
            "auto_reconnect": self.auto_reconnect,
            "reconnect_period": self.reconnect_period,
            "enable_tls": self.enable_tls,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
        }

# ==========================================================
# Sensor Model (used for MQTT + Dashboard + Live Data)
# ==========================================================
INDIA_TZ = timezone("Asia/Kolkata")

class Sensor(db.Model):
    __tablename__ = "sensors"

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey("devices.id"), nullable=False)
    topic = db.Column(db.String(255))       # ✅ added
    payload = db.Column(db.Text)            # ✅ added
    temperature = db.Column(db.Float)
    humidity = db.Column(db.Float)
    pressure = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    raw_data = db.Column(JSON)  # ✅ keeps your structured MQTT payload (JSON)

    # Relationship back to device
    device = db.relationship("Device", back_populates="sensors")

    def to_dict(self):
        ts = self.timestamp
        try:
            if ts and ts.tzinfo is None:
                from pytz import utc
                ts = utc.localize(ts)
            ts_india = ts.astimezone(INDIA_TZ) if ts else None
            ts_iso = ts_india.isoformat() if ts_india else None
        except Exception:
            ts_iso = str(ts)

        return {
            "id": self.id,
            "device_id": self.device_id,
            "topic": self.topic,
            "payload": self.payload,
            "temperature": self.temperature,
            "humidity": self.humidity,
            "pressure": self.pressure,
            "timestamp": ts_iso,
            "raw_data": self.raw_data,
        }

# ==========================================================
# Settings Model
# ==========================================================
class Setting(db.Model):
    __tablename__ = "settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.String(255))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {"key": self.key, "value": self.value}

# ========================================
# History Model (Stores past sensor records)
# ========================================
class History(db.Model):
    __tablename__ = "history"

    id = db.Column(db.Integer, primary_key=True)

    # Linked to a device
    device_id = db.Column(db.Integer, db.ForeignKey("devices.id"), nullable=True)

    temperature = db.Column(db.Float, nullable=True)
    humidity = db.Column(db.Float, nullable=True)
    pressure = db.Column(db.Float, nullable=True)

    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship back to Device
    device = db.relationship("Device", backref=db.backref("history", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "device_id": self.device_id,
            "temperature": self.temperature,
            "humidity": self.humidity,
            "pressure": self.pressure,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
