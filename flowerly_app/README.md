# Flowerly — Reproductive Health Intelligence System
**SW-ML-39 | CSC-2201 Machine Learning | Makerere University**

A dual-objective machine learning web application for personalized menstrual cycle
forecasting (SVR, MAE=0.473 days) and PCOS anomaly detection (XGBoost, PR-AUC=1.000).

---

## Folder Structure

```
flowerly_app/
├── app.py                  ← Flask backend (routes + model loading)
├── requirements.txt        ← Python dependencies
├── README.md               ← This file
├── models/
│   ├── final_model_svr.pkl ← Trained SVR model (copy from notebook output)
│   ├── pcos_classifier.pkl ← Trained XGBoost PCOS classifier
│   └── scaler.pkl          ← StandardScaler (fitted on training set only)
├── templates/
│   └── index.html          ← Main HTML page (Jinja2 template)
└── static/
    ├── css/
    │   └── style.css       ← All styles
    └── js/
        └── app.js          ← Frontend logic (form submit, render results, calendar)
```

---

## Setup Instructions

### Step 1 — Copy your trained models
After running the notebook, copy the three saved model files into the `models/` folder:
```
models/final_model_svr.pkl
models/pcos_classifier.pkl
models/scaler.pkl
```

### Step 2 — Install dependencies
```bash
pip install -r requirements.txt
```

### Step 3 — Run the app
```bash
python app.py
```
Then open your browser at: **http://localhost:5000**

---

## How It Works

1. User enters their last 3 cycle lengths into the form
2. The app computes derived features (rolling average, variability, PCOS risk flag)
3. Features are scaled using the saved StandardScaler
4. SVR model predicts the next cycle length
5. XGBoost classifier flags PCOS risk (threshold = 0.3)
6. Results show predicted length, fertile window, ovulation estimate, and a calendar strip

---

## Models Used

| Task                  | Model              | Metric         | Score  |
|-----------------------|--------------------|----------------|--------|
| Cycle length forecast | SVR (RBF, C=10)    | MAE (days)     | 0.473  |
| Cycle length forecast | SVR (RBF, C=10)    | R²             | 0.927  |
| PCOS detection        | XGBoost            | PR-AUC         | 1.000  |
| PCOS detection        | XGBoost            | Recall         | 1.000  |

Patient-Held-Out split: 100 train subjects / 26 test subjects

---

## Privacy
All inference runs locally on the server. No patient data is transmitted externally.
For full offline browser deployment, models can be compiled to ONNX/WebAssembly.

---

## Team
- Namatovu Christine Maria
- Nassiwa Hafswa
- Mukabera Alice

Supervisor: Ggaliwango Marvin
