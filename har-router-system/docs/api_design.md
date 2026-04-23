# API Endpoints – HAR Router System

## Base URL
`/api/v1`

---

## Authentication APIs

| Method | Endpoint     | Role       | Description                      | Request Body     | Response                     |
|--------|-------------|------------|----------------------------------|------------------|------------------------------|
| POST   | /auth/login | Admin/User | Validate fixed login credentials | email, password  | Login success / failure msg  |

---

## Dataset & Training APIs

| Method | Endpoint         | Role  | Description                                | Request Body | Response                              |
|--------|------------------|-------|--------------------------------------------|--------------|---------------------------------------|
| POST   | /dataset/upload  | Admin | Upload HAR dataset (CSV format)            | CSV file     | dataset_id                            |
| POST   | /train/start     | Admin | Start baseline + routed model training     | dataset_id   | training_id + status                  |
| GET    | /train/history   | Admin | Retrieve list of training sessions         | —            | List of training runs                 |
| GET    | /train/{id}      | Admin | Retrieve specific training session details | —            | Baseline & routed accuracy metrics    |

---

## Prediction APIs

| Method | Endpoint         | Role       | Description                     | Request Body        | Response                                   |
|--------|------------------|------------|---------------------------------|---------------------|--------------------------------------------|
| POST   | /predict         | Admin/User | Run activity classification     | Sensor input JSON   | Activity label + confidence + cluster ID   |
| GET    | /predict/history | Admin      | Retrieve past prediction logs   | —                   | List of prediction records                 |

---

## Analytics APIs

| Method | Endpoint                         | Role  | Description                          | Request Body | Response                        |
|--------|----------------------------------|-------|--------------------------------------|--------------|---------------------------------|
| GET    | /analytics/cluster-distribution  | Admin | Fetch cluster frequency data         | —            | Cluster-wise count dataset      |
| GET    | /analytics/accuracy-comparison   | Admin | Fetch baseline vs routed accuracy    | —            | Accuracy comparison metrics     |
| GET    | /analytics/logs                  | Admin | Fetch recent routing logs            | —            | Routing log table data          |