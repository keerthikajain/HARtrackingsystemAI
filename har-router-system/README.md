# HAR Router System

A full-stack Human Activity Recognition system that classifies real-time smartphone sensor data into activities like walking, sitting, standing, and more. Built with a FastAPI backend and a React frontend.

---

## What it does

You open the app on your phone, hit "Live Sensor", and it starts reading your accelerometer and gyroscope in real time. Every 50 readings it sends a window of sensor data to the backend, which extracts features, runs it through a trained Random Forest model, and returns the predicted activity with a confidence score. The whole thing updates live on screen.

There's also a manual mode where you can type in sensor values directly — useful for testing edge cases without needing a phone.

---

## Tech Stack

**Backend**
- Python + FastAPI
- scikit-learn (RandomForest, StandardScaler, LabelEncoder)
- PostgreSQL (user auth)
- joblib for model persistence

**Frontend**
- React 18 + Vite
- Tailwind CSS
- Recharts (analytics charts)
- Lucide React (icons)
- Device Motion API (live sensor access on mobile)

---

## How the ML pipeline works

1. Raw sensor data comes in as a window of 50 readings (ax, ay, az, gx, gy, gz)
2. Feature extraction pulls 24 statistical features per axis — mean, std, min, max, and more
3. StandardScaler normalizes the feature vector
4. Random Forest classifier predicts one of 6 activities
5. A lightweight temporal smoother applies a mild consensus boost if the last 3+ predictions agree

Training is done through the UI — upload a CSV, hit train, and the models get saved to `/models`.

---

## Activities recognized

- Walking
- Walking Upstairs
- Walking Downstairs
- Sitting
- Standing
- Laying

---

## Project structure

```
har-router-system/
├── src/
│   ├── main.py              # FastAPI app entry point
│   ├── auth.py              # Login / register endpoints
│   ├── predict.py           # Prediction endpoint
│   ├── train.py             # Training endpoint
│   ├── upload.py            # Dataset upload
│   ├── analytics.py         # Analytics + calorie estimates
│   ├── feedback.py          # User feedback on predictions
│   ├── collect.py           # Live sensor data collection
│   ├── logs.py              # Prediction log endpoints
│   ├── config.py            # Paths and constants
│   └── services/
│       ├── predict_service.py      # Model loading + inference
│       ├── train_service.py        # Training pipeline
│       ├── feature_extraction.py   # 24-feature extractor
│       ├── analytics_service.py    # Summary + calorie logic
│       ├── logs_service.py         # Log read/write
│       ├── upload_service.py       # CSV handling
│       ├── collect_service.py      # Sensor data handling
│       └── db_service.py           # PostgreSQL connection
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, Predict, Analytics, Upload, Login, Settings
│   │   ├── components/      # Layout, ActivityDisplay, FeedbackPanel
│   │   ├── services/        # ApiService, SensorService
│   │   ├── hooks/           # usePredictionSmoothing
│   │   ├── context/         # AuthContext
│   │   └── config/          # apiConfig (dynamic URL resolution)
│   ├── package.json
│   └── vite.config.js
├── models/                  # Saved .pkl files after training
├── data/                    # CSV datasets (gitignored)
├── logs/                    # gitignored — no longer used (data is in PostgreSQL)
└── docs/                    # Design docs and diagrams
```

---

## Running locally

**Backend**

```bash
cd har-router-system/src
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend**

```bash
cd har-router-system/frontend
npm install
npm run dev
```

The frontend runs on `https://localhost:5173` (HTTPS is needed for the Device Motion API on mobile).

For live sensor access from your phone, make sure your phone and laptop are on the same WiFi network. The frontend auto-detects LAN access and routes API calls through the Vite proxy to avoid mixed-content issues.

---

## Environment variables

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:8000
```

For production, set `VITE_API_URL` to your deployed backend URL.

---

## Training a model

1. Go to the Upload page
2. Upload a CSV with columns: `ax, ay, az, gx, gy, gz, activity`
3. Hit Train — the backend builds 50-sample windows, extracts features, trains a Random Forest, and saves the model
4. Once done, the Predict page is ready to use

---

## Deployment on EC2 with Docker

**Prerequisites on EC2:** Docker + Docker Compose installed, port 80 and 8000 open in the security group.

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd har-router-system

# 2. Create your env file
cp .env.example .env
# Edit .env — set a strong PG_PASSWORD

# 3. Build and start everything
docker compose up -d --build

# 4. Check it's running
docker compose ps
docker compose logs backend
```

The frontend is served on port 80. The backend API is on port 8000. PostgreSQL runs in its own container with a persistent volume so data survives restarts and redeployments.

To redeploy after a code change:

```bash
git pull
docker compose up -d --build
```

**Important for live sensor (Device Motion API):** Mobile browsers require HTTPS to access the accelerometer. On EC2 you'll need a domain with an SSL certificate. The easiest way is to put an HTTPS load balancer or Nginx with Let's Encrypt in front of port 80.

---

## Figma design

[View the UI design on Figma](https://www.figma.com/design/VhponbrtEOi9B0U9P0kytA/HAR-design?node-id=0-1&t=XiIYUkkr7KS3ScCn-1)
