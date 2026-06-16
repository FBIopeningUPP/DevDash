# DevDash

DevDash is a unified dashboard for managing all your Node.js, React, and TypeScript projects. It allows you to import projects, view available scripts, start/stop local development servers, and view real-time terminal outputs in a clean, professional interface.

## Features

- **Project Management**: Add projects by their absolute path.
- **Auto-Discovery**: Automatically parses `package.json` to find scripts and dependencies.
- **Process Management**: Start, stop, and restart development servers and scripts with a click.
- **Quick Actions**: Prominent buttons for common commands like `dev`, `start`, `build`, and `install`.
- **Real-Time Logs**: View `stdout` and `stderr` directly in the dashboard via Socket.IO.
- **Global Overview**: See all running instances across different projects in one place.

## Architecture

The application is built with:
- **Backend**: Node.js + Express + Socket.IO (Port 4000)
- **Frontend**: React + Vite (Port 5173)

## Quick Start

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation
1. Clone this repository.
2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Install frontend dependencies:
   ```bash
   cd ../frontend
   npm install
   ```

### Running the App
For Windows users, simply run the included batch script:
```bash
start-devdash.bat
```
This will open two terminal windows and start both the backend API and frontend UI.

Alternatively, you can start them manually:
1. Start the backend: `cd backend && npm start`
2. Start the frontend: `cd frontend && npm run dev`

Then, open [http://localhost:5173](http://localhost:5173) in your browser.

## Data Storage
Your projects are saved in `backend/data/projects.json`. This file is ignored by Git, so your local project paths remain private.
