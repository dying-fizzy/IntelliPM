# IntelliPM: Setup & Run Guide

Follow these instructions to launch the **IntelliPM** platform on any device. This guide covers the frontend, backend, ML service, and Local AI (Ollama) setup.

## 1. Prerequisites
- **Node.js**: Ensure you have Node.js installed (v18 or higher recommended).
- **Python**: Ensure you have Python 3.9+ installed for the AI microservice.
- **Ollama**: Required for local task generation. Download from: [ollama.com](https://ollama.com/)

## 2. Initial Setup
1.  **Copy the Code**: Extract the project files onto the new device.
2.  **Install Dependencies**: Run the following commands in the root directory:
    - **Frontend/Backend**:
      ```bash
      npm install
      ```
    - **ML Service**:
      ```bash
      pip install -r ml_service/requirements.txt
      ```

## 3. Local AI Setup (Ollama)
To use the custom task generator, team members must build the model locally:
1.  **Download Base Model**:
    ```bash
    ollama run llama3.2:1b
    ```
2.  **Build Custom Model**:
    In the project root (where the `Modelfile` is located), run:
    ```bash
    ollama create llama3-tasks -f Modelfile
    ```
3.  **Memory Optimization (For 8GB RAM / Low VRAM)**:
    If you encounter "AI Unavailable" errors, ensure `aiProvider.js` is configured with partial GPU offloading (`num_gpu: 15`).


## 4. Environment Configuration
Ensure your `.env` file in the root folder contains:
```env
VITE_SUPABASE_URL=https://yiuifglcqyasbcnmqxzy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpdWlmZ2xjcXlhc2Jjbm1xeHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzE1OTYsImV4cCI6MjA4OTQwNzU5Nn0.sh66TGPhf3cS3tT13cpP7grFuG-7Y7sSe_xFBGZmQR0
SECRET_KEY=intellipm_secret_key_123
AI_PROVIDER=ollama
OLLAMA_MODEL=llama3.2:1b
```

## 5. Launching the Platform
You need to run three services in separate terminal windows:

### A. Start the Backend
```bash
node server.js
```
*Server runs at http://localhost:5000*

### B. Start the ML Risk Service
```bash
python ml_service/main.py
```
*Service runs at http://localhost:8000*

### C. Start the Frontend
```bash
npm run dev
```
*Vite serves the UI (usually at http://localhost:5173 or :3000)*

---

## Troubleshooting "AI Unavailable"
1.  **Check Ollama**: Ensure the Ollama app is running in your system tray.
2.  **GPU Memory**: If you have a dedicated GPU with only 2GB RAM, close other apps (like Chrome or Games) to free up VRAM for the AI.
3.  **Timeout**: On very slow CPUs, the first generation might take 1-2 minutes. The system is configured with a 5-minute timeout to allow for this.
