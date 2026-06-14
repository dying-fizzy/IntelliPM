
# IntelliPM Foundation Setup Guide

Follow these steps to get your high-end project management platform running.

## 1. Prerequisites
- **Node.js** installed on your machine.
- Basic terminal knowledge.

## 2. Install Dependencies
Run these commands in your project root:
```bash
# Install frontend and backend dependencies
npm install express cors jsonwebtoken bcryptjs lucide-react framer-motion react-router-dom
```

## 3. Run the Backend
Open a terminal and run:
```bash
node server.js
```
*You should see: "IntelliPM Backend running at http://localhost:5000"*

## 4. Run the Frontend
In a **second terminal** window, run:
```bash
# This depends on your environment's dev server, 
# but usually for this tool, you just need to ensure 
# the files are being served via a React dev environment.
npm start
```

## 5. Explore Features
- **Theme Engine**: Toggle the sun/moon icon in the navbar.
- **Apple Aesthetics**: Notice the glassmorphism and smooth hover transitions.
- **Real Auth**: 
    1. Click "Sign In".
    2. Switch to "Sign Up".
    3. Enter your details and submit.
    4. You will be redirected to the Dashboard, and your user will be stored in `users.json` on the backend.

## Architecture Note
- **Frontend**: React 18 + Tailwind CSS.
- **Backend**: Node.js + Express (Port 5000).
- **Database**: `users.json` (Zero-Failure local JSON storage).
- **Auth**: JWT based tokenization.
