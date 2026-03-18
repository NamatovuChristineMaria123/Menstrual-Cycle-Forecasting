from flask import Flask, render_template, request, jsonify
import joblib
import numpy as np
import os

app = Flask(__name__)

# ── Load models ──────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

svr_model   = joblib.load(os.path.join(BASE_DIR, "models", "final_model_svr.pkl"))
pcos_clf    = joblib.load(os.path.join(BASE_DIR, "models", "pcos_classifier.pkl"))
scaler      = joblib.load(os.path.join(BASE_DIR, "models", "scaler.pkl"))

# Feature order must match training
FEATURE_COLS = [
    "PrevCycleLength",
    "Prev2CycleLength",
    "Prev3CycleLength",
    "RollingAvg3",
    "CycleVariability",
    "EstimatedDayofOvulation",
    "LengthofLutealPhase",
    "FirstDayofHigh",
    "TotalFertilityFormula",
    "LengthofMenses",
    "IsIrregular",
    "PCOS_Risk",
]


# ── Routes ───────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        # Pull values from request
        c1 = float(data["cycle1"])   # most recent cycle
        c2 = float(data["cycle2"])
        c3 = float(data["cycle3"])   # oldest of the three

        ovulation_day   = float(data.get("ovulation_day",  15.9))
        luteal_phase    = float(data.get("luteal_phase",   13.0))
        first_high      = float(data.get("first_high",     10.0))
        fertility_score = float(data.get("fertility_score", 5.0))
        menses_length   = float(data.get("menses_length",   5.0))

        # Derived features
        rolling_avg3      = round((c1 + c2 + c3) / 3, 2)
        cycle_variability = round(float(np.std([c1, c2, c3])), 2)
        is_irregular      = 1 if (c1 < 21 or c1 > 35) else 0
        pcos_risk_flag    = 1 if (c1 < 21 or c1 > 35) else 0

        features = np.array([[
            c1, c2, c3,
            rolling_avg3,
            cycle_variability,
            ovulation_day,
            luteal_phase,
            first_high,
            fertility_score,
            menses_length,
            is_irregular,
            pcos_risk_flag,
        ]])

        # Scale
        features_scaled = scaler.transform(features)

        # Predict cycle length — whole number of days only
        predicted_length = int(round(float(svr_model.predict(features_scaled)[0])))

        # Predict PCOS risk
        pcos_proba = float(pcos_clf.predict_proba(features_scaled)[0][1])
        pcos_flag  = int(pcos_proba >= 0.3)

        # Fertile window — all whole day numbers
        est_ovulation = int(round(predicted_length - luteal_phase))
        est_ovulation = max(1, min(est_ovulation, predicted_length))
        fertile_start = max(1, est_ovulation - 2)
        fertile_end   = min(predicted_length, est_ovulation + 2)

        return jsonify({
            "success":          True,
            "predicted_length": predicted_length,
            "pcos_flag":        pcos_flag,
            "pcos_probability": round(pcos_proba * 100, 1),
            "est_ovulation":    est_ovulation,
            "fertile_start":    fertile_start,
            "fertile_end":      fertile_end,
            "rolling_avg":      rolling_avg3,
            "variability":      cycle_variability,
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True, port=5000)
