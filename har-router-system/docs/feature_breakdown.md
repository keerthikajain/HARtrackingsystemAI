🚀 Feature Breakdown – HAR Router
 UI Features (Frontend – What User Sees)
 Authentication:

- Login screen
- Credential validation
- Logout functionality

 Dashboard:

- Navigation to:
  - Upload & Train
  - Prediction
  - Analytics
- Display current model version
- Quick system status view

 Dataset Upload & Training Screen:

- CSV dataset upload
- Upload validation message
- Train model button
- Training status indicator
- Display:
  - Cluster distribution
  - Baseline accuracy
  - Routed model accuracy
  - Accuracy uplift

 Prediction Screen:

- Input session feature values
- Submit prediction request

Display:
  - Predicted activity label
  - Prediction probability
  - Assigned cluster ID

 Analytics Screen:

- Baseline vs Routed accuracy comparison
- Cluster-wise performance breakdown
- Confusion matrix visualization
- ROC-AUC comparison
- Routing logs display

 Backend / System Features (Internal Logic)
📂 Dataset Validation & Preprocessing:

- Schema validation (561 features + subject ID + label)
- Missing value handling
- Feature scaling using StandardScaler
- Consistent preprocessing pipeline

 Clustering Engine:

- k-means clustering
- Optimal K selection using Silhouette Score
- Cluster label assignment
- Cluster size distribution analysis

 Baseline Model:

- Global Random Forest training
- 70/30 train-test split
- 5-fold cross-validation
- Accuracy, Precision, Recall, Macro-F1, ROC-AUC evaluation

 Cluster-Specific Models:

- Train one Random Forest per cluster
- Cluster-wise performance evaluation
- Overfitting check (train vs test accuracy)
- Model export (.pkl)

 Router Engine:

- Assign cluster using trained k-means
- Retrieve cluster-specific model
- Perform activity prediction
- Generate probability score
- Log routing decision

 Model Registry (PostgreSQL):

- Cluster-to-model mapping
- Model version tracking
- Store predictions
- Store routing logs
- Store performance metrics

 Infrastructure & Deployment:

- FastAPI backend
- React + Tailwind frontend
- PostgreSQL database
- Docker containerization
- Cloud deployment (EC2 / Render / Railway)