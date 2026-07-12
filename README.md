# UnscriptedFaiz

A full-stack personal blog web app built with Node.js, Express, SQLite, and EJS.

## Features
- Minimal, premium aesthetic (Fraunces & Lora typography)
- Dark/Light mode toggle
- Responsive design
- Admin panel to manage posts (Quill.js Rich Text Editor)
- Scheduled publishing via node-cron
- SQLite database (no external DB needed)
- SEO tags and RSS feed
- File uploads for cover images
- "Load More" pagination with skeleton loaders

## Setup Instructions

1. Clone or download the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and set your `ADMIN_PASSWORD` and `SESSION_SECRET`:
   ```bash
   cp .env.example .env
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000` in your browser.
6. The database and seed data will be automatically created on the first run.

## Admin Access
- Navigate to `http://localhost:3000/admin`
- Login with the password you set in `.env` (Default in `.env.example`: `Imamfaiz02@`)
