-- =========================================================
-- 002_add_default_brokers.sql — Adds 3 default MQTT brokers
-- =========================================================

INSERT INTO devices (name, broker_url, is_connected)
VALUES
  ('Factory Sensor 1', 'test.mosquitto.org', 0),
  ('Factory Sensor 2', 'broker.hivemq.com', 0),
  ('Factory Sensor 3', 'broker.emqx.io', 0);

-- Optional verification
SELECT * FROM devices;
