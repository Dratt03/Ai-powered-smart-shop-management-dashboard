from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Schema for creating a new product
class ProductCreate(BaseModel):
    code: str
    name: str
    category: str
    selling_price: float
    purchase_cost: Optional[float] = 0.0
    stock_quantity: int = 0
    low_stock_threshold: Optional[int] = 10
    unit: str = "bottle"

# Schema for updating an existing product
class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    selling_price: Optional[float] = None
    purchase_cost: Optional[float] = None
    stock_quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None

# Schema for sending product data to frontend
class ProductResponse(BaseModel):
    id: int
    code: str
    name: str
    category: str
    selling_price: float
    purchase_cost: float
    stock_quantity: int
    low_stock_threshold: int
    unit: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Schema for adjusting stock (adding stock or recording damaged items)
class StockAdjustment(BaseModel):
    change_amount: int  # e.g. +20 for restock, -2 for damaged
    reason: str         # e.g. "Supplier delivery", "Broken in store"

# --- Phase 4 Sales Schemas ---

class SaleItemCreate(BaseModel):
    product_code: str
    quantity: int

class SaleCreate(BaseModel):
    sale_number: Optional[str] = None  # Optional client receipt ID for duplicate prevention
    items: List[SaleItemCreate]

class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    product_code: str
    product_name: str
    quantity: int
    unit_price: float
    unit_cost: float
    total_price: float

    class Config:
        from_attributes = True

class SaleResponse(BaseModel):
    id: int
    sale_number: str
    total_amount: float
    created_at: datetime
    items: List[SaleItemResponse]

    class Config:
        from_attributes = True

# --- Phase 6 AI Assistant Schemas ---
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatAction(BaseModel):
    type: str  # "restock", "view_receipt", "navigate"
    label: str
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    receipt_id: Optional[int] = None

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

class ChatResponse(BaseModel):
    reply: str
    actions: Optional[List[ChatAction]] = []

class GeminiConfigUpdate(BaseModel):
    api_key: str

class GeminiConfigResponse(BaseModel):
    status: str
    message: str
    configured: bool
    masked_key: Optional[str] = None
    api_key: Optional[str] = None


