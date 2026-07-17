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

## Key Features & Optimizations

- **On-Demand Explainability (SHAP)**: Batch predictions score risk levels near-instantly, while detailed Tree SHAP explainability charts and narratives are loaded on-demand (~10ms) when clicking "Explain SHAP" on any applicant.
- **Client-Side CSV Parsing & Capping**: Replaced file uploads with fast client-side CSV parsing, capping inputs to the first 500 rows to prevent CPU bottlenecks and browser timeouts.
- **Detailed Progress Checklist**: Shows step-by-step progress status during file parsing, API submission, and scoring.
- **Auto Name Cleaning**: Excludes index/system columns (like `Unnamed: 0`) from applicant names, defaulting to clean, structured IDs when name metadata is missing.

