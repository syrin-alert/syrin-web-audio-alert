# 🛎️ Syrin Web Audio Alert

**Syrin Web Audio Alert** is a real-time alert playback interface that plays audio messages triggered by RabbitMQ events. It provides a simple web interface to receive, display, and play audio notifications in real time — perfect for observability, incident monitoring, or DevOps alerting environments.

---

## 🚀 Features

- ✅ Real-time alert reception via RabbitMQ
- 🔊 Automatic or manual playback of .mp3 audio from MinIO (S3-compatible)
- 📡 WebSocket-based push notifications
- 💾 Persistent alert history (JSON file-based)
- 📊 Realtime dashboard with stats by alert level and category
- 🧑‍💻 Simple sound activation & mute toggle
- 🧹 Automatic audio file cleanup after playback

---

## 🧱 Architecture Overview

- **Frontend**: HTML, CSS, Vanilla JS, WebSocket
- **Backend**: Node.js (Express + WebSocket + AMQP)
- **Message Queue**: RabbitMQ
- **Object Storage**: MinIO (S3-compatible)

---

## 📦 How It Works

1. Alerts are published to a RabbitMQ queue with metadata + reference to an `.mp3` file
2. The Node.js app receives the alert, generates a pre-signed MinIO URL
3. It stores the alert in a local history file (`alert-history.json`)
4. It pushes the alert via WebSocket to connected browser clients
5. The browser plays the audio and deletes the file via `/delete` once playback finishes
6. Dashboard updates stats in real time

---

## 🛠 Environment Variables

