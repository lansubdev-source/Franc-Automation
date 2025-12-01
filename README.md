# 🛰️ Franc Automation Dashboard

[![Backend: Flask](https://img.shields.io/badge/Backend-Flask-blue?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Frontend: React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Database: SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Dockerized](https://img.shields.io/badge/Deployed%20with-Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> 🚀 *An intelligent IoT-based automation dashboard for real-time device monitoring, MQTT data streaming, and 7-day history tracking — built using Flask, React, Tailwind CSS, and Docker.*

---

# 🛰️ Franc Automation Dashboard

A full-stack IoT automation dashboard for real-time device monitoring, MQTT data streaming, historical data management, and data export.  
Built using **Flask (Python)**, **React + Vite**, **Tailwind CSS**, and **Docker**.

---

## 📘 Project Overview

Franc Automation Dashboard provides:

- Real-time MQTT sensor readings  
- Live dashboard visualization  
- Device management  
- 7-day history with automatic rotation  
- CSV / JSON / ZIP data export  
- Responsive UI for industrial IoT environments  

This system includes:

- **Flask Backend** – APIs, MQTT ingestion, WebSockets  
- **React Frontend** – Live UI, history, charts  
- **SQLite Database** – Lightweight local storage  
- **Docker Compose** – Simplified deployment  

---

## ✨ Features

| Category | Description |
|----------|-------------|
| 🌐 Real-time Monitoring | MQTT sensor readings (temperature, humidity, pressure) |
| ⚙️ Device Management | Add/manage connected IoT devices |
| 📊 Dashboard | Real-time visualization with live updates |
| 🕒 History | Auto-managed 7-day rolling history |
| 💾 Export | JSON / CSV / ZIP download options |
| 🎨 UI | Tailwind CSS + shadcn UI |
| 🐳 Deployment | Dockerized backend & frontend |

---

## 🧩 System Architecture

![System Architecture](A_diagram_illustrates_a_Franc_Automation_Dashboard.png)

## ⚙️ Tech Stack

### **Frontend**
- React (Vite + TypeScript)  
- Tailwind CSS  
- shadcn-ui  
- Socket.IO client  

### **Backend**
- Flask (Python)  
- SQLAlchemy ORM  
- SQLite  
- paho-mqtt  
- Flask-SocketIO  
- Eventlet  

### **DevOps**
- Docker & Docker Compose  
- ngrok (optional)

---

## 🖥️ Local Setup

### **Backend Setup**

cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m backend.app
Backend runs at:
http://127.0.0.1:5000

Frontend Setup

cd frontend
npm install
npm run dev
Frontend runs at:
http://localhost:5173

🐳 Docker Setup (Recommended)

docker-compose up --build

📡 API Endpoints

Endpoint	Method	Description
/api/data/latest	GET	Latest sensor reading
/api/devices	GET	List all devices
/api/history	GET	Last 7 days history
/api/history/download/<date>	GET	JSON/CSV export
/api/history/download/last7.zip	GET	Full 7-day ZIP export

📊 Example Sensor Data

{
  "device_id": 1,
  "temperature": 28.7,
  "humidity": 65.3,
  "pressure": 1013,
  "timestamp": "2025-11-10T16:00:54"
}

🏁 Project Status

✔ Stable & fully functional
✔ Real-time MQTT tested
✔ History + exports working
