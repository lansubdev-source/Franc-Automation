BEGIN TRANSACTION;

CREATE TABLE settings_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    site_name TEXT,
    site_description TEXT,
    contact_email TEXT,
    footer_text TEXT,

    registration_enabled INTEGER DEFAULT 1,

    logo_url TEXT,
    favicon_url TEXT,
    client_logo_url TEXT
);

INSERT INTO settings_new (
    id, key, value, updated_at,
    site_name, site_description, contact_email, footer_text,
    registration_enabled, logo_url, favicon_url, client_logo_url
)
SELECT
    id, key, value, updated_at,
    site_name, site_description, contact_email, footer_text,
    registration_enabled, logo_url, favicon_url, client_logo_url
FROM settings;

DROP TABLE settings;

ALTER TABLE settings_new RENAME TO settings;

COMMIT;
