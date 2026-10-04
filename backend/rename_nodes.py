import sqlite3
import random

# Common prefixes/suffixes for UP villages/towns
prefixes = ["Ram", "Shyam", "Gopal", "Kishan", "Fateh", "Sultan", "Shah", "Ghazipur", "Mughal", "Gorakh", "Bagh", "Bhoj", "Kalyan", "Rampur", "Dharam"]
suffixes = ["pur", "nagar", "garh", "ganj", "khera", "bad", "gaon", "wala", "mandi"]

# Facility types
facility_types = [
    "Primary Health Centre (PHC)",
    "Community Health Centre (CHC)",
    "Sub-Centre",
    "District Hospital",
    "Rural Dispensary",
    "Jan Aushadhi Kendra",
    "Sanjeevani Clinic"
]

def generate_realistic_name():
    village = random.choice(prefixes) + random.choice(suffixes)
    facility = random.choice(facility_types)
    return f"{facility}, {village.capitalize()}"

def rename_nodes():
    conn = sqlite3.connect('lastmile.db')
    cursor = conn.cursor()
    
    # Fetch all clinics
    cursor.execute("SELECT id FROM clinics")
    clinics = cursor.fetchall()
    
    print(f"Renaming {len(clinics)} clinics...")
    
    updates = []
    for (clinic_id,) in clinics:
        new_name = generate_realistic_name()
        updates.append((new_name, clinic_id))
    
    # Batch update
    cursor.executemany("UPDATE clinics SET name = ? WHERE id = ?", updates)
    conn.commit()
    conn.close()
    
    print("Successfully renamed all clinics to realistic names!")

if __name__ == '__main__':
    rename_nodes()
