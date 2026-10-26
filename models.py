from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

# This class represents the "products" table in PostgreSQL.
class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False) # e.g. "CC"
    name = Column(String, nullable=False)                          # e.g. "Coca-Cola"
    category = Column(String, nullable=False)                      # e.g. "Beverages"
    selling_price = Column(Float, nullable=False)                  # e.g. 40.0
    purchase_cost = Column(Float, default=0.0, nullable=False)     # e.g. 30.0
    stock_quantity = Column(Integer, default=0, nullable=False)    # e.g. 50
    low_stock_threshold = Column(Integer, default=10, nullable=False) # Warning alert level
    unit = Column(String, default="bottle", nullable=False)        # e.g. "bottle", "packet", "kg"
    is_active = Column(Boolean, default=True, nullable=False)      # True = active, False = archived
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

# This class records stock changes (restocking, damaged, expired)
class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, nullable=False)
    change_amount = Column(Integer, nullable=False) # Positive (e.g. +20) or Negative (e.g. -2)
    reason = Column(String, nullable=False)         # e.g. "Restock / Delivery", "Damaged", "Expired"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

# This class represents a customer sale transaction / bill
class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    sale_number = Column(String, unique=True, index=True, nullable=False) # Unique invoice/receipt ID
    total_amount = Column(Float, nullable=False)                          # Grand total in Rupees
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")

# This class represents individual items included within a sale
class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    product_code = Column(String, nullable=False)                         # Snapshot of code at time of sale
    product_name = Column(String, nullable=False)                         # Snapshot of name at time of sale
    quantity = Column(Integer, nullable=False)                            # Number of units sold
    unit_price = Column(Float, nullable=False)                            # Price charged at time of sale
    unit_cost = Column(Float, default=0.0, nullable=False)                 # Purchase cost at time of sale
    total_price = Column(Float, nullable=False)                           # quantity * unit_price

    sale = relationship("Sale", back_populates="items")

