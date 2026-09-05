import requests
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import models
from database import engine, get_db

# Create DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="LastMile API")

# Setup CORS for local React development
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class LocationSchema(BaseModel):
    lat: float
    lng: float

class ClinicSchema(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    status: str

    class Config:
        orm_mode = True

class InventorySchema(BaseModel):
    id: Optional[int] = None
    masterCode: str
    name: str
    clinicId: str
    stock: int
    avgMonthlyUsage: int
    expiryDays: int

    class Config:
        orm_mode = True

class SimulateRequest(BaseModel):
    requestingClinicId: str
    requestedMedicineCode: str
    expiryThresholdDays: int = 15
    safetyBufferMultiplier: float = 1.2

# Pre-seed DB if empty
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    if not db.query(models.Clinic).first():
        clinics = [
            models.Clinic(id='C001', name='Rural Health Center Alpha', lat=28.7041, lng=77.1025, status='Active'),
            models.Clinic(id='C002', name='NGO Clinic Beta', lat=28.7100, lng=77.1200, status='Active'),
            models.Clinic(id='C003', name='District Hospital', lat=28.6500, lng=77.2000, status='Active'),
            models.Clinic(id='C004', name='Village Post Gamma', lat=28.7200, lng=77.0900, status='Active')
        ]
        db.add_all(clinics)
        
        inventory = [
            models.Inventory(masterCode='M-INS-001', name='Insulin Glargine 100IU', clinicId='C002', stock=45, avgMonthlyUsage=20, expiryDays=14),
            models.Inventory(masterCode='M-INS-001', name='Insulin Glargine 100IU', clinicId='C002', stock=30, avgMonthlyUsage=20, expiryDays=28),
            models.Inventory(masterCode='M-VAC-045', name='Hepatitis B Vaccine', clinicId='C001', stock=10, avgMonthlyUsage=30, expiryDays=180),
            models.Inventory(masterCode='M-ANT-009', name='Azithromycin 250mg', clinicId='C001', stock=120, avgMonthlyUsage=40, expiryDays=210),
            models.Inventory(masterCode='M-INS-001', name='Insulin Glargine 100IU', clinicId='C004', stock=5, avgMonthlyUsage=15, expiryDays=60),
            models.Inventory(masterCode='M-MED-221', name='Amoxicillin 500mg', clinicId='C003', stock=500, avgMonthlyUsage=100, expiryDays=300),
            models.Inventory(masterCode='M-PAR-110', name='Paracetamol 500mg', clinicId='C003', stock=200, avgMonthlyUsage=150, expiryDays=720),
            models.Inventory(masterCode='M-VAC-012', name='Polio Vaccine (OPV)', clinicId='C002', stock=80, avgMonthlyUsage=25, expiryDays=8),
            models.Inventory(masterCode='M-ANT-002', name='Amoxicillin 250mg', clinicId='C002', stock=60, avgMonthlyUsage=50, expiryDays=120),
        ]
        db.add_all(inventory)
        db.commit()

@app.get("/api/clinics", response_model=List[ClinicSchema])
def get_clinics(db: Session = Depends(get_db)):
    return db.query(models.Clinic).all()

@app.get("/api/hospitals")
def get_hospitals(db: Session = Depends(get_db)):
    """Return clinics enriched with aggregated inventory stats for the live map."""
    clinics = db.query(models.Clinic).all()
    all_inventory = db.query(models.Inventory).all()
    all_requests = db.query(models.Request).all()

    # Build per-clinic inventory lookup
    inv_by_clinic = {}
    for item in all_inventory:
        inv_by_clinic.setdefault(item.clinicId, []).append(item)

    result = []
    for c in clinics:
        items = inv_by_clinic.get(c.id, [])
        total_stock = sum(i.stock for i in items)
        low_stock = sum(1 for i in items if i.stock < i.avgMonthlyUsage)
        near_expiry = sum(1 for i in items if i.stock > 0 and i.expiryDays <= 15)
        out_of_stock = sum(1 for i in items if i.stock == 0)

        medicines = []
        for i in items:
            medicines.append({
                "name": i.name,
                "masterCode": i.masterCode,
                "stock": i.stock,
                "avgMonthlyUsage": i.avgMonthlyUsage,
                "expiryDays": i.expiryDays,
            })

        # Count active requests for this clinic
        active_requests = sum(
            1 for r in all_requests
            if (r.requesting_clinic_id == c.id or r.provider_clinic_id == c.id)
            and r.status in ("Pending", "In Transit")
        )

        result.append({
            "id": c.id,
            "name": c.name,
            "lat": c.lat,
            "lng": c.lng,
            "status": c.status,
            "totalStock": total_stock,
            "lowStock": low_stock,
            "nearExpiry": near_expiry,
            "outOfStock": out_of_stock,
            "skuCount": len(items),
            "activeRequests": active_requests,
            "medicines": medicines,
        })

    return result

@app.get("/api/routes/geometry")
def get_route_geometry(from_lat: float, from_lng: float, to_lat: float, to_lng: float):
    """Fetch OSRM route geometry (GeoJSON) for drawing road-following lines on the map."""
    osrm_url = (
        f"http://router.project-osrm.org/route/v1/driving/"
        f"{from_lng},{from_lat};{to_lng},{to_lat}"
        f"?overview=full&geometries=geojson"
    )
    try:
        resp = requests.get(osrm_url, timeout=8)
        data = resp.json()
        if data.get("code") == "Ok":
            route = data["routes"][0]
            return {
                "success": True,
                "geometry": route["geometry"],
                "distance_km": round(route["distance"] / 1000.0, 1),
                "duration_min": round(route["duration"] / 60.0, 1),
            }
        return {"success": False, "message": "OSRM returned no route"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/clinics", response_model=ClinicSchema)
def add_clinic(clinic: ClinicSchema, db: Session = Depends(get_db)):
    new_clinic = models.Clinic(
        id=clinic.id,
        name=clinic.name,
        lat=clinic.lat,
        lng=clinic.lng,
        status=clinic.status
    )
    db.add(new_clinic)
    db.commit()
    db.refresh(new_clinic)
    return new_clinic

@app.get("/api/inventory", response_model=List[InventorySchema])
def get_inventory(db: Session = Depends(get_db)):
    return db.query(models.Inventory).order_by(models.Inventory.id.desc()).all()

@app.post("/api/inventory")
def add_inventory(item: InventorySchema, db: Session = Depends(get_db)):
    new_item = models.Inventory(
        masterCode=item.masterCode,
        name=item.name,
        clinicId=item.clinicId,
        stock=item.stock,
        avgMonthlyUsage=item.avgMonthlyUsage,
        expiryDays=item.expiryDays
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@app.post("/api/simulate-transfer")
def simulate_transfer(req: SimulateRequest, db: Session = Depends(get_db)):
    requesting_clinic = db.query(models.Clinic).filter(models.Clinic.id == req.requestingClinicId).first()
    if not requesting_clinic:
        raise HTTPException(status_code=404, detail="Requesting clinic not found")

    all_inventory = db.query(models.Inventory).filter(
        models.Inventory.masterCode == req.requestedMedicineCode,
        models.Inventory.clinicId != req.requestingClinicId
    ).all()

    matches = []

    for item in all_inventory:
        buffer_stock = item.avgMonthlyUsage * req.safetyBufferMultiplier
        excess = item.stock - buffer_stock
        true_excess = int(excess) if excess > 0 else 0

        # Include if has true excess OR near expiry
        if true_excess > 0 or item.expiryDays <= req.expiryThresholdDays:
            provider_clinic = db.query(models.Clinic).filter(models.Clinic.id == item.clinicId).first()
            if not provider_clinic:
                continue

            # Transferable amount capped at 20 for demo
            transfer_amt = min(true_excess if true_excess > 0 else item.stock, 20)

            # Call OSRM Routing API (lon,lat order)
            dist_km, duration_min = None, None
            osrm_url = (
                f"http://router.project-osrm.org/route/v1/driving/"
                f"{requesting_clinic.lng},{requesting_clinic.lat};"
                f"{provider_clinic.lng},{provider_clinic.lat}?overview=false"
            )
            try:
                resp = requests.get(osrm_url, timeout=5)
                data = resp.json()
                if data.get("code") == "Ok":
                    route = data["routes"][0]
                    dist_km = round(route["distance"] / 1000.0, 1)
                    duration_min = round(route["duration"] / 60.0, 1)
            except Exception as e:
                print(f"OSRM Error for {provider_clinic.id}: {e}")

            matches.append({
                "providerClinic": {"id": provider_clinic.id, "name": provider_clinic.name},
                "providerInventoryId": item.id,
                "trueExcess": true_excess,
                "transferAmt": transfer_amt,
                "expiryDays": item.expiryDays,
                "nearExpiry": item.expiryDays <= req.expiryThresholdDays,
                "distanceKm": dist_km,
                "durationMin": duration_min,
                "stock": item.stock,
                "avgMonthlyUsage": item.avgMonthlyUsage
            })

    if not matches:
        return {"success": False, "message": "No clinics have excess stock for this medicine. Request escalated to State Depot."}

    # Rank: highest true excess first (best chance of fulfillment), ties broken by nearest distance
    matches.sort(key=lambda m: (-m["trueExcess"], m["distanceKm"] if m["distanceKm"] is not None else 9999))

    import json
    from datetime import datetime
    new_request = models.Request(
        requesting_clinic_id=req.requestingClinicId,
        medicine_code=req.requestedMedicineCode,
        created_at=datetime.utcnow().isoformat(),
        status="Pending",
        matches_json=json.dumps(matches)
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    return {"success": True, "requestId": new_request.id, "matches": matches}

@app.get("/api/requests")
def get_requests(db: Session = Depends(get_db)):
    return db.query(models.Request).order_by(models.Request.id.desc()).all()

class AcceptRequestSchema(BaseModel):
    provider_clinic_id: str
    custom_transfer_amt: Optional[int] = None

@app.post("/api/requests/{req_id}/accept")
def accept_request(req_id: int, payload: AcceptRequestSchema, db: Session = Depends(get_db)):
    import json, random, string
    from datetime import datetime

    db_req = db.query(models.Request).filter(models.Request.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Request not found")
    if db_req.status != "Pending":
        raise HTTPException(status_code=400, detail="Request already claimed or closed")

    matches = json.loads(db_req.matches_json) if db_req.matches_json else []
    match = next((m for m in matches if m["providerClinic"]["id"] == payload.provider_clinic_id), None)
    if not match:
        raise HTTPException(status_code=400, detail="Provider not in eligible list")

    transfer_amt = payload.custom_transfer_amt if payload.custom_transfer_amt and payload.custom_transfer_amt <= match["transferAmt"] else match["transferAmt"]

    # Deduct stock from provider NOW (medicine is leaving their clinic)
    provider_inv = db.query(models.Inventory).filter(models.Inventory.id == match["providerInventoryId"]).first()
    if not provider_inv or provider_inv.stock < transfer_amt:
        raise HTTPException(status_code=400, detail="Provider no longer has enough stock")

    provider_inv.stock -= transfer_amt

    # Generate 6-digit OTP
    otp = ''.join(random.choices(string.digits, k=6))

    # Save OTP, provider, provider inventory ID and transfer_amt on the request — DO NOT credit requester yet
    db_req.status = "In Transit"
    db_req.otp = otp
    db_req.provider_clinic_id = payload.provider_clinic_id
    db_req.provider_inventory_id = provider_inv.id
    db_req.transfer_amt = transfer_amt

    log = models.ActivityLog(
        time=datetime.utcnow().strftime("%H:%M"),
        message=f"Transfer of {transfer_amt} units of {db_req.medicine_code} dispatched from {payload.provider_clinic_id} → {db_req.requesting_clinic_id}. Awaiting delivery confirmation.",
        isSuccess=1
    )
    db.add(log)
    db.commit()

    return {"success": True, "message": "Request accepted. OTP generated.", "otp": otp}


@app.post("/api/requests/{req_id}/cancel")
def cancel_request(req_id: int, db: Session = Depends(get_db)):
    from datetime import datetime

    db_req = db.query(models.Request).filter(models.Request.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Request not found")
    if db_req.status != "Pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")

    db_req.status = "Cancelled"
    
    log = models.ActivityLog(
        time=datetime.utcnow().strftime("%H:%M"),
        message=f"Request for {db_req.medicine_code} by {db_req.requesting_clinic_id} was cancelled.",
        isSuccess=0
    )
    db.add(log)
    db.commit()

    return {"success": True, "message": "Request cancelled successfully."}

@app.delete("/api/inventory/{item_id}")
def remove_inventory(item_id: int, db: Session = Depends(get_db)):
    from datetime import datetime
    item = db.query(models.Inventory).filter(models.Inventory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    log = models.ActivityLog(
        time=datetime.utcnow().strftime("%H:%M"),
        message=f"Inventory record removed: {item.stock} units of {item.masterCode} ({item.name}) at clinic {item.clinicId}.",
        isSuccess=0
    )
    db.delete(item)
    db.add(log)
    db.commit()
    return {"success": True, "message": "Inventory item removed."}

class UseStockSchema(BaseModel):
    quantity: int

@app.patch("/api/inventory/{item_id}/use")
def use_stock(item_id: int, payload: UseStockSchema, db: Session = Depends(get_db)):
    from datetime import datetime
    item = db.query(models.Inventory).filter(models.Inventory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")
    if item.stock < payload.quantity:
        raise HTTPException(status_code=400, detail=f"Not enough stock. Current stock: {item.stock}")

    item.stock -= payload.quantity

    log = models.ActivityLog(
        time=datetime.utcnow().strftime("%H:%M"),
        message=f"{payload.quantity} units of {item.masterCode} ({item.name}) used at clinic {item.clinicId}. Remaining: {item.stock}.",
        isSuccess=1
    )
    db.add(log)
    db.commit()
    db.refresh(item)
    return {"success": True, "id": item.id, "stock": item.stock}


class VerifyDeliverySchema(BaseModel):
    otp: str

@app.post("/api/requests/{req_id}/verify")
def verify_delivery(req_id: int, payload: VerifyDeliverySchema, db: Session = Depends(get_db)):
    from datetime import datetime

    db_req = db.query(models.Request).filter(models.Request.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Request not found")
    if db_req.status != "In Transit":
        raise HTTPException(status_code=400, detail="Request is not awaiting delivery confirmation")
    if db_req.otp != payload.otp:
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please try again.")

    # Credit the requester's inventory now that delivery is confirmed
    requester_inv = db.query(models.Inventory).filter(
        models.Inventory.clinicId == db_req.requesting_clinic_id,
        models.Inventory.masterCode == db_req.medicine_code
    ).first()

    # Record delivered stock against the same expiry batch if it already exists in requester inventory, otherwise create a new batch entry.
    provider_inv = db.query(models.Inventory).filter(models.Inventory.id == db_req.provider_inventory_id).first()
    if not provider_inv:
        raise HTTPException(status_code=400, detail="Provider inventory record not found")

    requester_inv = db.query(models.Inventory).filter(
        models.Inventory.clinicId == db_req.requesting_clinic_id,
        models.Inventory.masterCode == db_req.medicine_code,
        models.Inventory.expiryDays == provider_inv.expiryDays
    ).first()

    if requester_inv:
        requester_inv.stock += db_req.transfer_amt
    else:
        new_inv = models.Inventory(
            masterCode=db_req.medicine_code,
            name=provider_inv.name,
            clinicId=db_req.requesting_clinic_id,
            stock=db_req.transfer_amt,
            avgMonthlyUsage=provider_inv.avgMonthlyUsage,
            expiryDays=provider_inv.expiryDays
        )
        db.add(new_inv)

    db_req.status = "Delivered"
    log = models.ActivityLog(
        time=datetime.utcnow().strftime("%H:%M"),
        message=f"Delivery confirmed! {db_req.transfer_amt} units of {db_req.medicine_code} received by {db_req.requesting_clinic_id} (expiry {provider_inv.expiryDays} days).",
        isSuccess=1
    )
    db.add(log)
    db.commit()
    return {"success": True, "message": "Delivery confirmed! Inventory updated."}

