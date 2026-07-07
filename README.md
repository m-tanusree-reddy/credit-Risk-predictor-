# Credit Risk Predictor

A credit default risk prediction project with a FastAPI backend, a trained model, and a React/Vite frontend adapted from the AI Studio design.

## Project Structure

```text
backend/                 FastAPI prediction service
frontend/                React/Vite dashboard UI
models/                  Trained model artifacts
data/                    Training data and data dictionary
notebook.ipynb           Model development notebook
requirements.txt         Python dependencies
```

The previous Streamlit UI is preserved at `frontend/legacy_streamlit_app.py`.

## Run Backend

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

The API runs at `http://127.0.0.1:8000`.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000` and calls the FastAPI backend by default.

To point the frontend at a different API host, create `frontend/.env.local`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```
