# LastMile — Smart Redistribution Network

LastMile is a scalable, dynamic web application designed to optimize the redistribution of medical supplies across rural clinic networks. It features a real-time live map, inventory management, and a request/delivery system to ensure essential medicines reach where they are needed most.

## Features

- **Live Map Interface**: Renders up to 50,000+ rural clinics using highly optimized `leaflet.markercluster`.
- **Intelligent Routing**: Computes OSRM-based road routes and visualizes active in-transit deliveries.
- **Inventory Management**: Tracks stock levels, predicts shortages based on average monthly usage, and flags near-expiry items.
- **Redistribution Requests**: Simulates inter-clinic medicine transfers based on surplus inventory and proximity.
- **Secure OTP Verification**: Implements rate-limited OTP verification for confirming deliveries.
- **Role-Based Access Control**: Sensitive actions and administrative views (e.g., viewing network-wide clinics) are locked securely behind the Admin profile.

## Tech Stack

- **Frontend**: React (Vite), React Router, Leaflet, FontAwesome
- **Backend**: FastAPI, SQLite, SQLAlchemy
- **Data Scaling**: Capable of efficiently handling 50,000+ nodes with $O(1)$ backend lookups and frontend DOM pagination.

## Setup & Installation

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install fastapi uvicorn sqlalchemy requests
python -m uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Optimizations Included
- **Backend Optimization**: Reduced $O(C \times R)$ loops to $O(C+R)$ lookups for request mapping. 
- **Payload Minimization**: Stripped empty nested arrays to drastically reduce JSON response sizes for 50k nodes.
- **Frontend Performance**: Implemented paginated sidebars and Leaflet marker clusters to prevent DOM freezing. 
- **Security Enhancements**: Added 429 rate limiting, Role-Based Access Controls (RBAC), and removed sensitive data from public API responses.
