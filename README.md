# UnscriptedFaiz || Unfiltered Faiz

A full-stack, lightweight, and premium personal blog web application built with **Node.js, Express, SQLite, and EJS**. 

Designed with a focus on editorial minimalism, typography (featuring Fraunces, Lora, and Cormorant Garamond), and smooth audio atmosphere.

---

## ✨ Features

- **Editorial Typography & Dark Mode:** Sleek transitions with full system preference synchronization and persistent manually toggled dark/light states.
- **Global Persistent Ambient Music Player:** 
  - Supports uploading custom audio files (MP3, WAV, M4A) and pasting YouTube links (uses a hidden YouTube background player).
  - Persists playback state, current progress, and volume across page navigations (using local storage).
  - Implements browser autoplay bypass (resuming play on first user interaction) and premium equalizer animations.
- **Dynamic Footer Verse:** Administrative setting to dynamically edit the Quranic verse and its citation shown at the bottom of pages.
- **Settings Panel:** Full settings dashboard to customize the homepage section headings, footer quotes, and audio source details.
- **Post & Category Management:**
  - Full CRUD operations with category badge selection.
  - Category management (add new, rename, upload category cover visuals).
  - Draft, Scheduled, and Published post statuses with scheduled post auto-publishing via `node-cron`.
- **Performance & Production Enhancements:**
  - WAL (Write-Ahead Logging) mode enabled in SQLite for improved file system concurrency.
  - Production-ready persistent storage layout for cloud environments (e.g. Railway) via `DATA_DIR` mounting.

---

## Tech Stack

- **Backend:** Node.js, Express, Multer (file uploads), express-session
- **Database:** SQLite (`better-sqlite3` wrapper)
- **Frontend Engine:** EJS (Embedded JavaScript Templates), CSS3 (Custom Variables, Media Queries)
- **Editor & Scheduling:** Quill.js Rich Text Editor, node-cron
- **Audio API:** HTML5 Audio API & YouTube IFrame Player API

---

## Setup Instructions

### 1. Clone & Install Dependencies
Clone the repository to your local machine and install packages:
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and set your secrets:
```bash
cp .env.example .env
```
Ensure you update `ADMIN_PASSWORD` and `SESSION_SECRET` in `.env`.

### 3. Running Locally
Start the server:
```bash
npm start
```
Open `http://localhost:3000` in your web browser. 

*Note: The SQLite database file will automatically initialize and seed with default settings, categories, and sample posts on the first start.*

---

## ⚙️ Administrative Dashboard

To access the administrative panel:
1. Navigate to `/admin` (e.g., `http://localhost:3000/admin`).
2. Log in using the password defined in your `.env` file.
3. Manage settings, create or edit posts, and set ambient background sounds under the **Settings** tab.

---

## ☁️ Deployment

The application is prepared for seamless production deployment (e.g. on Railway, Render, Heroku) with support for SQLite database persistence:
- Set the `NODE_ENV` environment variable to `production`.
- Mount a persistent directory at `/data` and specify `DATA_DIR=/data` in your deployment environment variables to preserve the database file and uploaded files across container rebuilds.
