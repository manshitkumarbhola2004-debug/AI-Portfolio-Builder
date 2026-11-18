# AI-Powered Portfolio Builder

A starter project built with **Node.js, Express, MongoDB and Gemini AI**. The frontend is plain HTML/CSS/JavaScript for a simple setup and fast local demo (the backend is ready for a React frontend later).

## Features
- Portfolio profile editor and live preview
- Save/load profile in MongoDB
- AI About Me generator using Gemini API
- AI content improver using Gemini API
- Responsive layout
- API key stays on the backend in `.env`

## Requirements
1. Node.js 18 or newer (Node 20 LTS recommended)
2. MongoDB Community Server running locally, OR a MongoDB Atlas connection string
3. Gemini API key for the AI buttons

## Setup on Windows
1. Extract this ZIP.
2. Open the extracted `ai-portfolio-builder` folder in VS Code.
3. Open Terminal in VS Code (`Terminal > New Terminal`).
4. Install dependencies:
   ```bash
   npm install
   ```
5. Copy `.env.example` and rename the copy to `.env`.
6. Open `.env` and set your MongoDB URI and Gemini API key:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/ai_portfolio_builder
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY
   GEMINI_MODEL=gemini-2.5-flash
   ```
   If using MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string.
7. Start the app:
   ```bash
   npm start
   ```
8. Open **http://localhost:5000** in your browser.

## Get a Gemini API key
Create an API key in Google AI Studio: https://aistudio.google.com/app/apikey
Do not share your key or commit the `.env` file to GitHub.

## MongoDB options
- Local: install and start MongoDB Community Server, then keep the default URI.
- Atlas: create a free cluster, create a database user, allow your current IP in Network Access, and paste the connection string into `.env`.

## Troubleshooting
- `MongoDB connection refused`: MongoDB server is not running, or the URI is incorrect.
- `Gemini API key missing`: check that `.env` exists in the project root and the key is set.
- `API key invalid` / model error: verify the key and `GEMINI_MODEL` in Google AI Studio.
- Port in use: change `PORT=5001` in `.env`, restart, then open `http://localhost:5001`.

## Important demo note
This is a functional MVP, not a production deployment. It stores one demo profile in the database and does not yet include multi-user authentication, PDF resume parsing, or public hosting. Do not use real sensitive personal data in a classroom demo.
