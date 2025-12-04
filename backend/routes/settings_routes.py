from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
from backend.extensions import db
from backend.models import Settings

settings_bp = Blueprint("settings_bp", __name__)
UPLOAD_FOLDER = "backend/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@settings_bp.route("/settings", methods=["GET"])
def get_settings():
    settings = Settings.query.first()

    if not settings:
        return jsonify({"message": "no settings", "data": {}}), 200

    return jsonify({
        "message": "success",
        "data": {
            "site_name": settings.site_name,
            "site_description": settings.site_description,
            "contact_email": settings.contact_email,
            "footer_text": settings.footer_text,
            "registration_enabled": settings.registration_enabled,
            "logo_url": settings.logo_url,
            "favicon_url": settings.favicon_url,
            "client_logo_url": settings.client_logo_url
        }
    }), 200


@settings_bp.route("/settings", methods=["POST"])
def update_settings():
    try:
        site_name = request.form.get("siteName")
        site_description = request.form.get("siteDescription")
        contact_email = request.form.get("contactEmail")
        footer_text = request.form.get("footerText")
        registration_enabled = request.form.get("registrationEnabled") == "true"

        logo = request.files.get("logoFile")
        favicon = request.files.get("faviconFile")
        client_logo = request.files.get("clientLogoFile")

        settings = Settings.query.first()
        if not settings:
            settings = Settings()

        def save_file(file):
            if not file:
                return None
            filename = secure_filename(file.filename)
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            file.save(filepath)
            return f"/uploads/{filename}"

        logo_url = save_file(logo)
        favicon_url = save_file(favicon)
        client_logo_url = save_file(client_logo)

        # Update values
        settings.site_name = site_name
        settings.site_description = site_description
        settings.contact_email = contact_email
        settings.footer_text = footer_text
        settings.registration_enabled = registration_enabled

        if logo_url: settings.logo_url = logo_url
        if favicon_url: settings.favicon_url = favicon_url
        if client_logo_url: settings.client_logo_url = client_logo_url

        db.session.add(settings)
        db.session.commit()

        return jsonify({"message": "Settings updated successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_bp.route("/uploads/<path:filename>")
def uploaded_files(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)
