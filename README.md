<<<<<<< HEAD
# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/e177de5c-f90a-4f49-94da-73b2c69cbad5

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/e177de5c-f90a-4f49-94da-73b2c69cbad5) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/e177de5c-f90a-4f49-94da-73b2c69cbad5) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
=======
# Franc-Automation
>>>>>>> 5a66a203dccbb3ffa70277c159515104fc94187e
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
- File Saver (`file-saver`)
- React Query (`@tanstack/react-query`)

### 🧱 Backend
- Flask (Python)
- SQLAlchemy ORM
- SQLite Database
- Flask-SocketIO
- paho-mqtt (MQTT communication)
- Eventlet (for async operations)

### 🐳 DevOps
- Docker + Docker Compose
- ngrok (for testing in public networks)

---

## 📂 Folder Structure

Franc-Auto/
│
├── backend/
│ ├── app.py # Flask entry point
│ ├── models.py # SQLAlchemy ORM models
│ ├── mqtt_service.py # MQTT service for live updates
│ ├── routes/
│ │ ├── data_routes.py # Sensor data API
│ │ ├── device_routes.py # Device management API
│ │ ├── history_routes.py # History and download API
│ ├── instance/
│ │ └── devices.db # SQLite database
│ ├── extensions.py # DB and SocketIO initialization
│ └── requirements.txt
│
├── frontend/
│ ├── src/
│ │ ├── pages/
│ │ │ ├── Dashboard.tsx
│ │ │ ├── Devices.tsx
│ │ │ ├── LiveData.tsx
│ │ │ ├── History.tsx
│ │ ├── components/
│ │ ├── main.tsx
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
# Step 1: Navigate to backend folder
cd backend

# Step 2: Create virtual environment
python -m venv venv
venv\Scripts\activate     # Windows
# OR
source venv/bin/activate  # macOS/Linux

# Step 3: Install dependencies
pip install -r requirements.txt

# Step 4: Run Flask backend
python -m backend.app
➡️ Backend runs at: http://127.0.0.1:5000

⚛️ Frontend Setup
bash
Copy code
# Step 1: Navigate to frontend
cd frontend

# Step 2: Install dependencies
npm install

# Step 3: Start development server
npm run dev
➡️ Frontend runs at: http://localhost:8080

🐳 Docker Setup (Recommended)
To build and run both backend and frontend using Docker:

bash
Copy code
docker-compose up --build
🧩 The stack includes:

Flask backend → port 5000

React frontend → served inside container

SQLite database → persistent under backend/instance/devices.db

To stop the containers:

bash
Copy code
docker-compose down
📡 API Endpoints
Endpoint	Method	Description
/api/data/latest	GET	Fetch the most recent sensor readings
/api/devices	GET	Retrieve all registered devices
/api/devices/:id/connect	POST	Connect or activate a device
/api/history	GET	Fetch last 7 days of grouped data
`/api/history/download/<date>?format=json	csv`	GET
`/api/history/download/last7.zip?format=json	csv`	GET

🕒 History Page Functionality
The History page fetches data for the last 7 days via /api/history.

Each day’s data is shown as a separate card with:

Date

Record count

Buttons to download as JSON or CSV.

When the 8th day is reached, the oldest day automatically disappears from the UI (not deleted from DB).

Data is grouped by actual date, ensuring chronological accuracy.

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
💡 Development Options
Edit Using Lovable
You can modify this project directly on Lovable.dev.
All changes made there are committed automatically to GitHub.

Local Development
bash
Copy code
git clone <YOUR_REPOSITORY_URL>
cd Franc-Auto
npm install
npm run dev
Push changes:

bash
Copy code
git add .
git commit -m "Project updates"
git push
🧠 Future Enhancements
📈 Real-time charts for sensor trends

🔔 Alert system for threshold breach

👥 User authentication and role management

☁️ PostgreSQL / MongoDB integration

📄 Data export as Excel or PDF reports

🧭 Geographic device map visualization

📜 License
This project is licensed under the MIT License.
You are free to use, modify, and distribute this code with proper attribution.

👨‍💻 Author
Jeffrin M
Full Stack Developer | IoT & Automation Enthusiast

📍 Dubai, UAE
📧 [Add your email here]
🔗 [Add your LinkedIn or Portfolio link here]

🏁 Project Status
✅ Stable and fully functional
✅ MQTT Integration tested
✅ Live dashboard & history exports working
🚧 Charts and alerts coming soon

⭐ If you like this project, give it a star on GitHub!

yaml
Copy code

---

✅ **Instructions:**
1. Open your project in VS Code or GitHub.  
2. Replace your current `README.md` content with the **entire Markdown text above**.  
3. Save and commit:
   ```bash
   git add README.md
   git commit -m "Added complete README for Franc Automation project"
   git push