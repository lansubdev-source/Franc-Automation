# Franc-Automation
5a66a203dccbb3ffa70277c159515104fc94187e
# 🛰️ Franc Automation Dashboard

[![Backend: Flask](https://img.shields.io/badge/Backend-Flask-blue?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Frontend: React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Database: SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Dockerized](https://img.shields.io/badge/Deployed%20with-Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> 🚀 *An intelligent IoT-based automation dashboard for real-time device monitoring, MQTT data streaming, and 7-day history tracking — built using Flask, React, Tailwind CSS, and Docker.*

---

## 📘 Project Overview

**Franc Automation Dashboard** is a full-stack IoT solution that enables real-time monitoring of connected devices, MQTT data visualization, and historical data export.  
It combines a **Flask backend** and a **React + Vite frontend**, fully containerized with **Docker Compose**.

This project is designed for **industrial IoT, automation, and sensor analytics applications**, providing live insights and historical data downloads.

---

## ✨ Features

| Category | Feature | Description |
|-----------|----------|-------------|
| 🌐 Real-time Monitoring | MQTT integration | Displays live sensor readings (temperature, humidity, pressure) from multiple brokers. |
| ⚙️ Device Management | Multi-device support | Manage and visualize multiple connected IoT devices. |
| 🧠 Dashboard | Live visualization | View device status and sensor trends in real-time. |
| 🕒 History | 7-day rolling archive | Automatically keeps last 7 days’ data (oldest day hidden automatically). |
| 💾 Data Export | JSON / CSV / ZIP | Download data day-wise or all 7 days combined. |
| 🎨 UI Design | Dark mode | Responsive Tailwind CSS + shadcn UI components. |
| 🧱 Database | SQLite | Lightweight database integrated with SQLAlchemy ORM. |
| 🐳 Deployment | Docker | Complete containerized deployment using Docker Compose. |

---

## 🧩 System Architecture

java
Copy code
           ┌────────────────────────┐
           │      MQTT Brokers       │
           │ (HiveMQ / Mosquitto / EMQX) │
           └────────────┬────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│                  Flask Backend                │
│───────────────────────────────────────────────│
│  • MQTT Service (paho-mqtt)                   │
│  • SQLAlchemy ORM + SQLite                    │
│  • Flask-SocketIO for live updates            │
│  • REST APIs (devices, data, history)         │
└──────────────────────────┬────────────────────┘
                           │ JSON + WebSocket
                           ▼
┌───────────────────────────────────────────────┐
│              React Frontend (Vite)            │
│───────────────────────────────────────────────│
│  • Live dashboard and charts                  │
│  • History with CSV/JSON download             │
│  • Tailwind + Shadcn dark theme UI            │
└───────────────────────────────────────────────┘
yaml
Copy code

---

## ⚙️ Tech Stack

### 🖥️ Frontend
- React (Vite + TypeScript)
- Tailwind CSS
- Shadcn/UI Components
- Socket.IO Client
- React Query (`@tanstack/react-query`)

### 🧱 Backend
- Flask (Python)
- SQLAlchemy ORM
- SQLite Database
- Flask-SocketIO
- paho-mqtt (MQTT communication)
- Eventlet (async worker)

### 🐳 DevOps
- Docker + Docker Compose
- ngrok (public network testing)

---

## 📂 Folder Structure

Franc-Auto/
│
├── backend/
│ ├── app.py
│ ├── models.py
│ ├── mqtt_service.py
│ ├── routes/
│ ├── instance/
│ ├── extensions.py
│ └── requirements.txt
│
├── frontend/
│ ├── src/
│ ├── vite.config.ts
│ ├── tailwind.config.js
│ └── package.json
│
├── docker-compose.yml
├── Dockerfile
└── README.md

yaml
Copy code

---

## 🖥️ Local Setup

### 🐍 Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m backend.app
⚛️ Frontend Setup
bash
Copy code
cd frontend
npm install
npm run dev
🐳 Docker Setup
bash
Copy code
docker-compose up --build
📡 API Endpoints
Endpoint	Method	Description
/api/data/latest	GET	Latest sensor data
/api/devices	GET	All devices
/api/history	GET	Last 7 days grouped
/api/history/download/<date>	GET	JSON / CSV
/api/history/download/last7.zip	GET	Full export

📊 Example Sensor Record
json
Copy code
{
  "id": 415,
  "device_id": 1,
  "topic": "francauto/devices/Factory Sensor 1",
  "temperature": 28.75,
  "humidity": 65.3,
  "pressure": 1013.1,
  "timestamp": "2025-11-10T16:00:54.393001"
}

🏁 Project Status
✅ Stable & functional
🔌 MQTT integration tested
📊 Live dashboard + exports working