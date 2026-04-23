"""
feature_extraction.py
Computes 150 features from raw phone sensor window, then normalizes
them to UCI [-1,1] scale using saved per-feature min/max.

Feature order matches UCI HAR time-domain columns exactly:
  tBodyAcc, tGravityAcc, tBodyAccJerk, tBodyGyro, tBodyGyroJerk (22 each = 110)
  tBodyAccMag, tGravityAccMag, tBodyAccJerkMag, tBodyGyroMag, tBodyGyroJerkMag (8 each = 40)
"""

import numpy as np

N_FEATURES  = 150
_ACC_NORM   = 9.81      # m/s2 -> g units (UCI total_acc is in g)
_GYRO_NORM  = 57.2958   # deg/s -> rad/s (UCI body_gyro is in rad/s)

# Loaded at runtime by predict_service after training
_normalizer = None

def set_normalizer(norm):
    global _normalizer
    _normalizer = norm

def _ema_gravity(s, alpha=0.8):
    s = np.asarray(s, dtype=float)
    g = np.zeros_like(s)
    g[0] = s[0]
    for i in range(1, len(s)):
        g[i] = alpha * g[i-1] + (1-alpha) * s[i]
    return g

def _xyz_block(x, y, z):
    x=np.asarray(x,float); y=np.asarray(y,float); z=np.asarray(z,float)
    n=len(x)
    mx,my,mz = float(np.mean(x)),float(np.mean(y)),float(np.mean(z))
    return [
        mx,my,mz,
        float(np.std(x)),float(np.std(y)),float(np.std(z)),
        float(np.mean(np.abs(x-mx))),float(np.mean(np.abs(y-my))),float(np.mean(np.abs(z-mz))),
        float(np.max(x)),float(np.max(y)),float(np.max(z)),
        float(np.min(x)),float(np.min(y)),float(np.min(z)),
        float((np.sum(np.abs(x))+np.sum(np.abs(y))+np.sum(np.abs(z)))/n),
        float(np.sum(x**2)/n),float(np.sum(y**2)/n),float(np.sum(z**2)/n),
        float(np.percentile(x,75)-np.percentile(x,25)),
        float(np.percentile(y,75)-np.percentile(y,25)),
        float(np.percentile(z,75)-np.percentile(z,25)),
    ]

def _mag_block(m):
    m=np.asarray(m,float); mean=float(np.mean(m))
    return [mean,float(np.std(m)),float(np.mean(np.abs(m-mean))),
            float(np.max(m)),float(np.min(m)),
            float(np.sum(np.abs(m))/len(m)),float(np.sum(m**2)/len(m)),
            float(np.percentile(m,75)-np.percentile(m,25))]

def _compute_raw_features(ax,ay,az,gx,gy,gz):
    ax=np.asarray(ax,float); ay=np.asarray(ay,float); az=np.asarray(az,float)
    gx=np.asarray(gx,float); gy=np.asarray(gy,float); gz=np.asarray(gz,float)
    grav_x=_ema_gravity(ax); grav_y=_ema_gravity(ay); grav_z=_ema_gravity(az)
    body_ax=ax-grav_x; body_ay=ay-grav_y; body_az=az-grav_z
    jerk_ax=np.diff(body_ax); jerk_ay=np.diff(body_ay); jerk_az=np.diff(body_az)
    jerk_gx=np.diff(gx); jerk_gy=np.diff(gy); jerk_gz=np.diff(gz)
    acc_mag=np.sqrt(body_ax**2+body_ay**2+body_az**2)
    grav_mag=np.sqrt(grav_x**2+grav_y**2+grav_z**2)
    acc_jerk_mag=np.sqrt(jerk_ax**2+jerk_ay**2+jerk_az**2)
    gyro_mag=np.sqrt(gx**2+gy**2+gz**2)
    gyro_jerk_mag=np.sqrt(jerk_gx**2+jerk_gy**2+jerk_gz**2)
    feats=[]
    feats+=_xyz_block(body_ax,body_ay,body_az)
    feats+=_xyz_block(grav_x,grav_y,grav_z)
    feats+=_xyz_block(jerk_ax,jerk_ay,jerk_az)
    feats+=_xyz_block(gx,gy,gz)
    feats+=_xyz_block(jerk_gx,jerk_gy,jerk_gz)
    feats+=_mag_block(acc_mag)
    feats+=_mag_block(grav_mag)
    feats+=_mag_block(acc_jerk_mag)
    feats+=_mag_block(gyro_mag)
    feats+=_mag_block(gyro_jerk_mag)
    result=np.array(feats,dtype=np.float64)
    assert len(result)==N_FEATURES, f"Got {len(result)}, expected {N_FEATURES}"
    return result

def _apply_uci_normalization(feats):
    """
    Normalization is skipped when training on raw sensor data (har_raw.csv).
    The StandardScaler handles normalization during training and inference.
    """
    return feats

def extract_features_from_window(window):
    """From raw phone SensorReading objects."""
    ax = np.array([r.ax for r in window],float) / _ACC_NORM
    ay = np.array([r.ay for r in window],float) / _ACC_NORM
    az = np.array([r.az for r in window],float) / _ACC_NORM
    gx = np.array([r.gx for r in window],float) / _GYRO_NORM
    gy = np.array([r.gy for r in window],float) / _GYRO_NORM
    gz = np.array([r.gz for r in window],float) / _GYRO_NORM
    raw = _compute_raw_features(ax,ay,az,gx,gy,gz)
    return _apply_uci_normalization(raw)

def extract_features_from_arrays(ax,ay,az,gx,gy,gz):
    """From UCI dataset arrays. Already in [-1,1] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no processing needed."""
    return _compute_raw_features(ax,ay,az,gx,gy,gz)
