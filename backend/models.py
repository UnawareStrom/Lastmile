from sqlalchemy import Column, Integer, String, Float
from database import Base

class Clinic(Base):
    __tablename__ = "clinics"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    lat = Column(Float)
    lng = Column(Float)
    status = Column(String, default="Active")

class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    masterCode = Column(String, index=True)
    name = Column(String, index=True)
    clinicId = Column(String, index=True)
    stock = Column(Integer)
    avgMonthlyUsage = Column(Integer)
    expiryDays = Column(Integer)

class Request(Base):
    __tablename__ = "requests"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    requesting_clinic_id = Column(String, index=True)
    medicine_code = Column(String, index=True)
    created_at = Column(String)
    status = Column(String, default="Pending")
    matches_json = Column(String, nullable=True)
    otp = Column(String, nullable=True)
    provider_clinic_id = Column(String, nullable=True)
    provider_inventory_id = Column(Integer, nullable=True)
    transfer_amt = Column(Integer, nullable=True)
    otp_attempts = Column(Integer, default=0)

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    time = Column(String)
    message = Column(String)
    isSuccess = Column(Integer) # 1 for True, 0 for False
