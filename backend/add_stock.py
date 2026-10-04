import random
from sqlalchemy.orm import Session
from database import engine, SessionLocal
from models import Clinic, Inventory

def add_stock_to_all_clinics():
    db = SessionLocal()
    clinics = db.query(Clinic).all()
    
    medicines = [
        {"masterCode": "MED001", "name": "Paracetamol 500mg"},
        {"masterCode": "MED002", "name": "Amoxicillin 250mg"},
        {"masterCode": "MED003", "name": "ORS Sachets"},
        {"masterCode": "MED004", "name": "Ibuprofen 400mg"},
        {"masterCode": "MED005", "name": "Cetirizine 10mg"}
    ]

    inventory_records = []
    
    print(f"Adding stock for {len(clinics)} clinics...")

    for clinic in clinics:
        # Give each clinic 2-4 random medicines
        num_meds = random.randint(2, 4)
        selected_meds = random.sample(medicines, num_meds)
        
        for med in selected_meds:
            stock = random.randint(10, 500)
            avgMonthlyUsage = random.randint(20, 200)
            expiryDays = random.randint(30, 730)
            
            record = Inventory(
                masterCode=med["masterCode"],
                name=med["name"],
                clinicId=clinic.id,
                stock=stock,
                avgMonthlyUsage=avgMonthlyUsage,
                expiryDays=expiryDays
            )
            inventory_records.append(record)
            
        # Commit in batches of 10000 records to prevent memory issues
        if len(inventory_records) >= 10000:
            db.bulk_save_objects(inventory_records)
            db.commit()
            print(f"Inserted a batch of 10,000 records...")
            inventory_records.clear()

    # Commit any remaining records
    if inventory_records:
        db.bulk_save_objects(inventory_records)
        db.commit()
        print(f"Inserted final batch of records...")

    db.close()
    print("Stock addition complete.")

if __name__ == "__main__":
    add_stock_to_all_clinics()
