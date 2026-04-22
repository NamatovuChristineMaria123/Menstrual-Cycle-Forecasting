from flask import Flask, render_template, request, jsonify
import joblib
import numpy as np
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, "predictions.db")

svr_model = joblib.load(os.path.join(BASE_DIR, "models", "DEPLOY_svr_fp32.pkl"))
pcos_clf  = joblib.load(os.path.join(BASE_DIR, "models", "DEPLOY_xgb_fp32_inference.pkl"))
scaler    = joblib.load(os.path.join(BASE_DIR, "models", "DEPLOY_scaler.pkl"))

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at       TEXT    NOT NULL,
                cycle1           REAL    NOT NULL,
                cycle2           REAL    NOT NULL,
                cycle3           REAL    NOT NULL,
                ovulation_day    REAL,
                luteal_phase     REAL,
                menses_length    REAL,
                predicted_length INTEGER NOT NULL,
                pcos_flag        INTEGER NOT NULL,
                pcos_probability REAL    NOT NULL,
                est_ovulation    INTEGER NOT NULL,
                fertile_start    INTEGER NOT NULL,
                fertile_end      INTEGER NOT NULL,
                rolling_avg      REAL    NOT NULL,
                variability      REAL    NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        conn.commit()

init_db()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        c1 = float(data["cycle1"])
        c2 = float(data["cycle2"])
        c3 = float(data["cycle3"])
        ovulation_day   = float(data.get("ovulation_day",  15.9))
        luteal_phase    = float(data.get("luteal_phase",   13.0))
        first_high      = float(data.get("first_high",     10.0))
        fertility_score = float(data.get("fertility_score", 5.0))
        menses_length   = float(data.get("menses_length",   5.0))

        rolling_avg3      = round((c1 + c2 + c3) / 3, 2)
        cycle_variability = round(float(np.std([c1, c2, c3])), 2)
        is_irregular      = 1 if (c1 < 21 or c1 > 35) else 0
        pcos_risk_flag    = is_irregular

        features = np.array([[c1, c2, c3, rolling_avg3, cycle_variability,
                               ovulation_day, luteal_phase, first_high, fertility_score,
                               menses_length, is_irregular, pcos_risk_flag]])
        features_scaled  = scaler.transform(features)
        predicted_length = int(round(float(svr_model.predict(features_scaled)[0])))
        pcos_proba       = float(pcos_clf.predict_proba(features_scaled)[0][1])
        pcos_flag        = int(pcos_proba >= 0.3)

        est_ovulation = int(round(predicted_length - luteal_phase))
        est_ovulation = max(1, min(est_ovulation, predicted_length))
        fertile_start = max(1, est_ovulation - 2)
        fertile_end   = min(predicted_length, est_ovulation + 2)

        result = {
            "success": True,
            "predicted_length": predicted_length,
            "pcos_flag": pcos_flag,
            "pcos_probability": round(pcos_proba * 100, 1),
            "est_ovulation": est_ovulation,
            "fertile_start": fertile_start,
            "fertile_end": fertile_end,
            "rolling_avg": rolling_avg3,
            "variability": cycle_variability,
        }

        with get_db() as conn:
            cur = conn.execute("""
                INSERT INTO predictions
                  (created_at,cycle1,cycle2,cycle3,ovulation_day,luteal_phase,menses_length,
                   predicted_length,pcos_flag,pcos_probability,est_ovulation,fertile_start,
                   fertile_end,rolling_avg,variability)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (datetime.utcnow().isoformat(), c1, c2, c3, ovulation_day, luteal_phase,
                  menses_length, predicted_length, pcos_flag, round(pcos_proba*100,1),
                  est_ovulation, fertile_start, fertile_end, rolling_avg3, cycle_variability))
            conn.commit()
            result["id"] = cur.lastrowid
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route("/history", methods=["GET"])
def history():
    try:
        with get_db() as conn:
            rows = conn.execute("SELECT * FROM predictions ORDER BY id DESC LIMIT 20").fetchall()
        return jsonify({"success": True, "history": [dict(r) for r in rows]})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/history/<int:pred_id>", methods=["DELETE"])
def delete_prediction(pred_id):
    try:
        with get_db() as conn:
            conn.execute("DELETE FROM predictions WHERE id = ?", (pred_id,))
            conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/history", methods=["DELETE"])
def clear_history():
    try:
        with get_db() as conn:
            conn.execute("DELETE FROM predictions")
            conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/settings", methods=["GET"])
def get_settings():
    try:
        with get_db() as conn:
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return jsonify({"success": True, "settings": {r["key"]: r["value"] for r in rows}})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/settings", methods=["POST"])
def save_settings():
    try:
        data = request.get_json()
        with get_db() as conn:
            for key, value in data.items():
                conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", (key, str(value)))
            conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=7860)
