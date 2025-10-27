from datetime import datetime
from backend.extensions import db

# ==========================================================
# Association Tables
# ==========================================================
role_permissions = db.Table(
    "role_permissions",
    db.metadata,
    db.Column("role_id", db.Integer, db.ForeignKey("roles.id"), primary_key=True),
    db.Column("permission_id", db.Integer, db.ForeignKey("permissions.id"), primary_key=True),
    extend_existing=True
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
            "roles": [role.name for role in self.roles],
            "devices": [device.name for device in self.devices],
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat()
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
        backref=db.backref("roles", lazy="dynamic")
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "permissions": [p.name for p in self.permissions],
            "created_at": self.created_at.isoformat()
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
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description
        }

# ==========================================================
# Device Model
# ==========================================================
class Device(db.Model):
    __tablename__ = "devices"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sensors = db.relationship("Sensor", backref="device", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "protocol": self.protocol,
            "host": self.host,
            "port": self.port,
            "client_id": self.client_id,
            "username": self.username,
            "mqtt_version": self.mqtt_version,
            "keep_alive": self.keep_alive,
            "auto_reconnect": self.auto_reconnect,
            "reconnect_period": self.reconnect_period,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

# ==========================================================
# Sensor Model (with live MQTT fields)
# ==========================================================
class Sensor(db.Model):
    __tablename__ = "sensors"
    __table_args__ = {"extend_existing": True}

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('devices.id'), nullable=False)
    topic = db.Column(db.String(255))
    payload = db.Column(db.Text)
    temperature = db.Column(db.Float, nullable=True)
    humidity = db.Column(db.Float, nullable=True)
    pressure = db.Column(db.Float, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "device_id": self.device_id,
            "topic": self.topic,
            "payload": self.payload,
            "temperature": self.temperature,
            "humidity": self.humidity,
            "pressure": self.pressure,
            "timestamp": self.timestamp.isoformat()
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
