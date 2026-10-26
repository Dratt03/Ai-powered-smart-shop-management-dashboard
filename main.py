from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base, get_db
from models import Product, StockMovement, Sale, SaleItem
from schemas import (
    ProductCreate, 
    ProductUpdate, 
    ProductResponse, 
    StockAdjustment,
    SaleCreate,
    SaleResponse,
    SaleItemResponse,
    ChatRequest,
    ChatResponse,
    ChatAction,
    GeminiConfigUpdate,
    GeminiConfigResponse
)

app = FastAPI(title="AI-Powered Smart Shop Management Dashboard")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to generate a short product code suggestion from a product name
def generate_suggested_code(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in name).strip()
    words = cleaned.split()
    if not words:
        return ""
    if len(words) >= 2:
        return "".join(w[0] for w in words[:3]).upper()
    else:
        return words[0][:3].upper()

# Startup event: ensure database tables exist, schema updates, and initial product seed
@app.on_event("startup")
def startup_setup():
    import time
    # Retry database connection up to 10 times (prevents Docker boot race conditions)
    retries = 10
    while retries > 0:
        try:
            Base.metadata.create_all(bind=engine)
            break
        except Exception as err:
            retries -= 1
            if retries == 0:
                print(f"[Startup Error] Failed to connect to database: {err}")
                raise err
            print(f"[Startup] Waiting for PostgreSQL database to be ready... ({retries} retries left)")
            time.sleep(1)

    db = next(get_db())
    try:
        # Ensure column low_stock_threshold exists if table was created earlier
        db.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10;"))
        db.commit()
    finally:
        db.close()

# ---------------- API ENDPOINTS ----------------

# 1. Health check endpoint
@app.get("/api/health")
def check_health():
    return {
        "status": "online",
        "message": "FastAPI backend is running successfully!"
    }

# 2. Database connection check
@app.get("/api/db-check")
def check_database(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT 1")).scalar()
        return {
            "status": "connected",
            "message": "Successfully connected to PostgreSQL database!",
            "result": result
        }
    except Exception as error:
        return {
            "status": "error",
            "message": f"Database connection error: {str(error)}"
        }

# 3. Suggest a product code based on product name
@app.get("/api/products/suggest-code")
def suggest_code(name: str = Query(..., description="The name of the product")):
    suggested = generate_suggested_code(name)
    return {"suggested_code": suggested}

# 4. List and search products (by code or name)
@app.get("/api/products", response_model=List[ProductResponse])
def get_products(
    search: Optional[str] = Query(None, description="Search by product code or name"),
    archived_only: bool = Query(False, description="Whether to show only archived products"),
    db: Session = Depends(get_db)
):
    query = db.query(Product)
    
    if archived_only:
        # Show ONLY archived products
        query = query.filter(Product.is_active == False)
    else:
        # Show ONLY active products
        query = query.filter(Product.is_active == True)
        
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (Product.code.ilike(search_term)) | (Product.name.ilike(search_term))
        )
        
    return query.order_by(Product.id.asc()).all()

# 5. Get a single product by short code (e.g. typing "CC")
@app.get("/api/products/by-code/{code}", response_model=ProductResponse)
def get_product_by_code(code: str, db: Session = Depends(get_db)):
    clean_code = code.strip().upper()
    product = db.query(Product).filter(Product.code == clean_code).first()
    if not product:
        raise HTTPException(
            status_code=404, 
            detail=f"Product with code '{clean_code}' was not found."
        )
    return product

# 6. Add a new product (prevents duplicate codes)
@app.post("/api/products", response_model=ProductResponse, status_code=201)
def create_product(product_data: ProductCreate, db: Session = Depends(get_db)):
    clean_code = product_data.code.strip().upper()
    
    existing = db.query(Product).filter(Product.code == clean_code).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Product code '{clean_code}' is already used by '{existing.name}'. Please choose a different code."
        )
        
    new_product = Product(
        code=clean_code,
        name=product_data.name.strip(),
        category=product_data.category.strip(),
        selling_price=product_data.selling_price,
        purchase_cost=product_data.purchase_cost or 0.0,
        stock_quantity=product_data.stock_quantity,
        low_stock_threshold=product_data.low_stock_threshold or 10,
        unit=product_data.unit.strip(),
        is_active=True
    )
    
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

# 7. Edit product information
@app.put("/api/products/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, update_data: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
        
    if update_data.name is not None:
        product.name = update_data.name.strip()
    if update_data.category is not None:
        product.category = update_data.category.strip()
    if update_data.selling_price is not None:
        product.selling_price = update_data.selling_price
    if update_data.purchase_cost is not None:
        product.purchase_cost = update_data.purchase_cost
    if update_data.stock_quantity is not None:
        product.stock_quantity = update_data.stock_quantity
    if update_data.low_stock_threshold is not None:
        product.low_stock_threshold = update_data.low_stock_threshold
    if update_data.unit is not None:
        product.unit = update_data.unit.strip()
    if update_data.is_active is not None:
        product.is_active = update_data.is_active
        
    db.commit()
    db.refresh(product)
    return product

# 8. Adjust stock (Add incoming stock or record damaged stock with reason)
@app.post("/api/products/{product_id}/adjust-stock", response_model=ProductResponse)
def adjust_stock(product_id: int, adjustment: StockAdjustment, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
        
    if adjustment.change_amount == 0:
        raise HTTPException(status_code=400, detail="Stock adjustment amount cannot be 0.")
        
    # Check for negative stock
    new_quantity = product.stock_quantity + adjustment.change_amount
    if new_quantity < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reduce stock below 0. Current stock is {product.stock_quantity} {product.unit}s."
        )
        
    product.stock_quantity = new_quantity
    
    # Save movement record
    movement = StockMovement(
        product_id=product.id,
        change_amount=adjustment.change_amount,
        reason=adjustment.reason.strip() or "Manual adjustment"
    )
    db.add(movement)
    db.commit()
    db.refresh(product)
    return product

# 9. Archive a product (soft delete - preserves historical records)
@app.delete("/api/products/{product_id}")
def archive_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
        
    product.is_active = False
    db.commit()
    return {"message": f"Product '{product.name}' ({product.code}) has been archived."}

# 10. Unarchive / Restore a product back to active
@app.post("/api/products/{product_id}/unarchive")
def unarchive_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
        
    product.is_active = True
    db.commit()
    return {"message": f"Product '{product.name}' ({product.code}) has been restored to active."}

# Helper to generate a unique human-friendly receipt number
def generate_receipt_number(db: Session) -> str:
    today_str = datetime.utcnow().strftime("%Y%m%d")
    today_prefix = f"REC-{today_str}-"
    existing_today = db.query(Sale).filter(Sale.sale_number.like(f"{today_prefix}%")).count()
    return f"{today_prefix}{existing_today + 1:04d}"

# 11. Record a new sale (Phase 4: Sales Management)
@app.post("/api/sales", response_model=SaleResponse, status_code=201)
def create_sale(sale_data: SaleCreate, db: Session = Depends(get_db)):
    if not sale_data.items:
        raise HTTPException(status_code=400, detail="Cannot complete sale: no items in cart.")

    # 1. Idempotency Check: Prevent double-charging / duplicate submission
    if sale_data.sale_number:
        clean_sale_number = sale_data.sale_number.strip()
        existing_sale = db.query(Sale).filter(Sale.sale_number == clean_sale_number).first()
        if existing_sale:
            # Already completed; return existing record safely without deducting stock again
            return existing_sale
    else:
        clean_sale_number = generate_receipt_number(db)

    # 2. Validation Step: verify all items exist and have enough stock
    items_to_process = []
    for item in sale_data.items:
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Item quantity must be at least 1.")

        code = item.product_code.strip().upper()
        product = db.query(Product).filter(Product.code == code, Product.is_active == True).first()
        if not product:
            raise HTTPException(
                status_code=404, 
                detail=f"Product with code '{code}' does not exist or is archived."
            )

        if product.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{product.name}' ({code}). Available: {product.stock_quantity} {product.unit}s, Requested: {item.quantity}."
            )

        items_to_process.append((product, item.quantity))

    # 3. Transaction Execution: Atomic write with rollback on error
    try:
        new_sale = Sale(
            sale_number=clean_sale_number,
            total_amount=0.0
        )
        db.add(new_sale)
        db.flush() # Populate new_sale.id

        total_amount = 0.0
        for product, quantity in items_to_process:
            line_total = round(product.selling_price * quantity, 2)
            total_amount += line_total

            # Deduct stock
            product.stock_quantity -= quantity

            # Record stock movement log for audit trail
            movement = StockMovement(
                product_id=product.id,
                change_amount=-quantity,
                reason=f"Sale #{new_sale.sale_number}"
            )
            db.add(movement)

            # Record sale item snapshot
            sale_item = SaleItem(
                sale_id=new_sale.id,
                product_id=product.id,
                product_code=product.code,
                product_name=product.name,
                quantity=quantity,
                unit_price=product.selling_price,
                unit_cost=product.purchase_cost,
                total_price=line_total
            )
            db.add(sale_item)

        new_sale.total_amount = round(total_amount, 2)
        db.commit()
        db.refresh(new_sale)
        return new_sale

    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to record sale: {str(error)}"
        )

# 12. List past sales (recent history)
@app.get("/api/sales", response_model=List[SaleResponse])
def get_sales(limit: int = 50, db: Session = Depends(get_db)):
    sales = db.query(Sale).order_by(Sale.id.desc()).limit(limit).all()
    return sales

# 13. Get single sale receipt by ID
@app.get("/api/sales/{sale_id}", response_model=SaleResponse)
def get_sale_by_id(sale_id: int, db: Session = Depends(get_db)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale receipt not found.")
    return sale

# 14. Reports & Analytics Summary (Live Recap & Dashboard Reports)
@app.get("/api/reports/summary")
def get_reports_summary(
    period: str = Query("today", description="Period: today, 7days, 30days, all"),
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    
    # Active products statistics
    active_products = db.query(Product).filter(Product.is_active == True).all()
    total_products = len(active_products)
    
    low_stock_list = []
    for p in active_products:
        threshold = p.low_stock_threshold if p.low_stock_threshold is not None else 10
        if p.stock_quantity <= threshold:
            low_stock_list.append({
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "category": p.category,
                "stock_quantity": p.stock_quantity,
                "low_stock_threshold": threshold,
                "unit": p.unit,
                "selling_price": p.selling_price
            })
    # Sort lowest stock first
    low_stock_list.sort(key=lambda x: x["stock_quantity"])
    
    out_of_stock_count = sum(1 for p in active_products if p.stock_quantity == 0)
    total_inventory_items = sum(p.stock_quantity for p in active_products)
    inventory_val_retail = sum(p.stock_quantity * p.selling_price for p in active_products)
    inventory_val_cost = sum(p.stock_quantity * (p.purchase_cost or 0.0) for p in active_products)

    # Category breakdown
    category_map = {}
    for p in active_products:
        cat = p.category or "Other"
        if cat not in category_map:
            category_map[cat] = {"category": cat, "product_count": 0, "total_stock": 0}
        category_map[cat]["product_count"] += 1
        category_map[cat]["total_stock"] += p.stock_quantity
    category_breakdown = sorted(category_map.values(), key=lambda x: x["total_stock"], reverse=True)

    # Sales & Revenue calculations
    today_start = datetime(now.year, now.month, now.day)
    
    all_sales = db.query(Sale).order_by(Sale.id.desc()).all()
    total_sales_count = len(all_sales)
    total_revenue = sum(s.total_amount for s in all_sales)

    today_sales = [s for s in all_sales if s.created_at >= today_start]
    today_sales_count = len(today_sales)
    today_revenue = sum(s.total_amount for s in today_sales)

    # Filter period sales
    if period == "today":
        period_sales = today_sales
    elif period == "7days":
        cutoff = now - timedelta(days=7)
        period_sales = [s for s in all_sales if s.created_at >= cutoff]
    elif period == "30days":
        cutoff = now - timedelta(days=30)
        period_sales = [s for s in all_sales if s.created_at >= cutoff]
    else: # "all"
        period_sales = all_sales

    period_sales_count = len(period_sales)
    period_revenue = sum(s.total_amount for s in period_sales)

    # Profit calculations
    period_sale_ids = set(s.id for s in period_sales)
    all_sale_items = db.query(SaleItem).all()
    
    period_profit = 0.0
    total_profit = 0.0
    product_sales_map = {}

    for item in all_sale_items:
        profit_per_unit = item.unit_price - (item.unit_cost or 0.0)
        line_profit = profit_per_unit * item.quantity
        total_profit += line_profit

        if item.sale_id in period_sale_ids:
            period_profit += line_profit

        # Aggregate top products for the selected period (or all-time if none in period)
        target_set = period_sale_ids if period_sale_ids else set(s.id for s in all_sales)
        if item.sale_id in target_set:
            code = item.product_code
            if code not in product_sales_map:
                product_sales_map[code] = {
                    "code": item.product_code,
                    "name": item.product_name,
                    "quantity_sold": 0,
                    "total_revenue": 0.0
                }
            product_sales_map[code]["quantity_sold"] += item.quantity
            product_sales_map[code]["total_revenue"] += item.total_price

    top_products = sorted(product_sales_map.values(), key=lambda x: x["quantity_sold"], reverse=True)[:5]
    profit_margin_pct = (period_profit / period_revenue * 100) if period_revenue > 0 else 0.0

    # Recent 5 sales
    recent_sales = []
    for s in all_sales[:5]:
        item_names = [f"{it.product_name} ({it.quantity})" for it in s.items]
        recent_sales.append({
            "id": s.id,
            "sale_number": s.sale_number,
            "total_amount": s.total_amount,
            "created_at": s.created_at.isoformat(),
            "items_count": sum(it.quantity for it in s.items),
            "item_summary": ", ".join(item_names)
        })

    return {
        "period": period,
        "period_revenue": round(period_revenue, 2),
        "period_sales_count": period_sales_count,
        "period_profit": round(period_profit, 2),
        "profit_margin_pct": round(profit_margin_pct, 1),
        "today_revenue": round(today_revenue, 2),
        "today_sales_count": today_sales_count,
        "total_revenue": round(total_revenue, 2),
        "total_sales_count": total_sales_count,
        "total_profit": round(total_profit, 2),
        "total_products": total_products,
        "low_stock_count": len(low_stock_list),
        "out_of_stock_count": out_of_stock_count,
        "total_inventory_items": total_inventory_items,
        "inventory_val_retail": round(inventory_val_retail, 2),
        "inventory_val_cost": round(inventory_val_cost, 2),
        "low_stock_items": low_stock_list[:10],
        "top_products": top_products,
        "recent_sales": recent_sales,
        "category_breakdown": category_breakdown
    }

# 15. AI Assistant Chatbot Endpoint (Integrated Home Dashboard Assistant)
@app.post("/api/ai/chat", response_model=ChatResponse)
def ai_chat(chat_data: ChatRequest, db: Session = Depends(get_db)):
    user_query = chat_data.message.strip()
    if not user_query:
        return ChatResponse(reply="Please ask a question about your store's sales, stock, or products!")

    # 1. Fetch live database snapshots
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    
    active_products = db.query(Product).filter(Product.is_active == True).all()
    all_sales = db.query(Sale).order_by(Sale.id.desc()).all()
    today_sales = [s for s in all_sales if s.created_at >= today_start]
    
    today_rev = sum(s.total_amount for s in today_sales)
    total_rev = sum(s.total_amount for s in all_sales)
    
    # Calculate profit
    all_sale_items = db.query(SaleItem).all()
    total_profit = sum((it.unit_price - (it.unit_cost or 0.0)) * it.quantity for it in all_sale_items)
    
    today_sale_ids = set(s.id for s in today_sales)
    today_profit = sum((it.unit_price - (it.unit_cost or 0.0)) * it.quantity for it in all_sale_items if it.sale_id in today_sale_ids)
    
    # Low stock & out of stock
    low_stock = [p for p in active_products if p.stock_quantity <= (p.low_stock_threshold or 10)]
    out_of_stock = [p for p in active_products if p.stock_quantity == 0]
    
    # Top products
    product_sales_map = {}
    for item in all_sale_items:
        c = item.product_code
        if c not in product_sales_map:
            product_sales_map[c] = {"code": c, "name": item.product_name, "qty": 0, "rev": 0.0}
        product_sales_map[c]["qty"] += item.quantity
        product_sales_map[c]["rev"] += item.total_price
    top_products = sorted(product_sales_map.values(), key=lambda x: x["qty"], reverse=True)

    # 2. Check if GEMINI_API_KEY is available in environment
    gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if gemini_key and gemini_key != "your_gemini_api_key_here":
        system_context = f"""
You are the AI Assistant for "AI-Powered Smart Shop Management Dashboard", an intelligent assistant for a retail store owner.
Do NOT use any emojis in your response.
Current Date/Time: {now.strftime("%Y-%m-%d %H:%M")}
Store Live Database Snapshot:
- Today's Revenue: ₹{today_rev:.2f} ({len(today_sales)} bills)
- Today's Profit: ₹{today_profit:.2f}
- All-Time Revenue: ₹{total_rev:.2f} ({len(all_sales)} bills)
- All-Time Profit: ₹{total_profit:.2f}
- Active Products: {len(active_products)}
- Low Stock Items ({len(low_stock)}): {', '.join(f"{p.name} ({p.code}: {p.stock_quantity} left)" for p in low_stock) if low_stock else "None"}
- Out of Stock Items: {', '.join(p.name for p in out_of_stock) if out_of_stock else "None"}
- Top Selling Products: {', '.join(f"{p['name']} ({p['qty']} sold)" for p in top_products[:3]) if top_products else "None"}
All Products:
{', '.join(f"{p.name} [Code: {p.code}, Stock: {p.stock_quantity} {p.unit}s, Price: ₹{p.selling_price:.2f}]" for p in active_products)}

Answer in concise, helpful, professional shopkeeper language (use Indian Rupees ₹). Format key metrics in bold. Do not use any emojis. If recommending restocking, mention product names clearly.
"""
        prompt = f"{system_context}\n\nUser Question: {user_query}"
        reply_text = None
        used_model = None

        # Candidate models (modern 3.5/latest down to legacy flash)
        candidate_models = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-1.5-flash"]

        # 2a. Call via Google Gemini API
        for model_name in candidate_models:
            try:
                import requests
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                res = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=15)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts and "text" in parts[0]:
                            reply_text = parts[0]["text"].strip()
                            used_model = model_name
                            print(f"[AI Assistant] Successfully generated response using Google {model_name}")
                            break
                else:
                    print(f"[AI Assistant] Model {model_name} returned status {res.status_code}: {res.text[:120]}")
            except Exception as e:
                print(f"[AI Assistant] Request error on {model_name}: {e}")

        if reply_text:
            import re
            cleaned_reply = re.sub(r'[\U00010000-\U0010ffff]|[\u2600-\u27bf]|[\u2300-\u23ff]|[\u2b50]', '', reply_text)
            actions = []
            for p in low_stock:
                if p.name.lower() in cleaned_reply.lower() or p.code.lower() in cleaned_reply.lower():
                    actions.append(ChatAction(
                        type="restock",
                        label=f"Restock {p.name}",
                        product_id=p.id,
                        product_name=p.name,
                        product_code=p.code
                    ))
            return ChatResponse(reply=cleaned_reply.strip(), actions=actions[:3])

    # 3. Intelligent Local Analytics Engine (Runs instantly without external API key)
    query_lower = user_query.lower()
    actions = []

    # Greeting / Help
    if any(w in query_lower for w in ["hello", "hi", "hey", "namaste", "who are you", "what can you do", "help"]):
        reply = (
            f"Hello! I am your **AI Store Assistant**.\n\n"
            f"I can help you monitor your store in real-time. Here are a few things you can ask me:\n"
            f"- *'How much did I sell today?'*\n"
            f"- *'What is my total profit?'*\n"
            f"- *'Which products should I restock?'*\n"
            f"- *'What is my top selling item?'*\n"
            f"- *'Check stock of an item (e.g. by name or code)'*\n"
            f"- *'What is my store inventory valuation?'*"
        )
        return ChatResponse(reply=reply)

    # Restock / Low stock / Out of stock queries
    if any(w in query_lower for w in ["restock", "low stock", "out of stock", "reorder", "alert", "shortage", "running out", "need stock"]):
        if not low_stock:
            reply = "**All products are currently well-stocked** above their warning levels. No items need immediate restocking."
        else:
            lines = []
            for p in low_stock:
                status = "OUT OF STOCK" if p.stock_quantity == 0 else f"**{p.stock_quantity} {p.unit}s left** (alert at {p.low_stock_threshold})"
                lines.append(f"- **{p.name}** (`{p.code}`): {status}")
                actions.append(ChatAction(
                    type="restock",
                    label=f"Restock {p.name}",
                    product_id=p.id,
                    product_name=p.name,
                    product_code=p.code
                ))
            reply = (
                f"**Attention Needed: {len(low_stock)} item(s) low on stock!**\n\n"
                + "\n".join(lines)
                + "\n\nClick below to immediately restock incoming items:"
            )
        return ChatResponse(reply=reply, actions=actions)

    # Sales & Revenue queries
    if any(w in query_lower for w in ["sell today", "sale today", "today sale", "today's sale", "today revenue", "today's revenue", "made today", "earned today"]):
        today_margin = (today_profit / today_rev * 100) if today_rev > 0 else 0.0
        reply = (
            f"**Today's Sales Summary:**\n\n"
            f"- Total Revenue: **₹{today_rev:.2f}**\n"
            f"- Bills Completed: **{len(today_sales)}**\n"
            f"- Estimated Profit: **₹{today_profit:.2f}** ({today_margin:.1f}% margin)\n\n"
            f"*All-time revenue stands at ₹{total_rev:.2f} across {len(all_sales)} total orders.*"
        )
        return ChatResponse(reply=reply)

    if any(w in query_lower for w in ["total sale", "total revenue", "all time sale", "all-time", "total money", "how much sold", "overall sales"]):
        margin = (total_profit / total_rev * 100) if total_rev > 0 else 0.0
        reply = (
            f"**Overall All-Time Store Performance:**\n\n"
            f"- Total Lifetime Revenue: **₹{total_rev:.2f}**\n"
            f"- Total Customer Bills: **{len(all_sales)}**\n"
            f"- Total Net Profit: **₹{total_profit:.2f}** ({margin:.1f}% margin)\n"
            f"- Active Catalog: **{len(active_products)} products**"
        )
        return ChatResponse(reply=reply)

    # Profit queries
    if any(w in query_lower for w in ["profit", "margin", "earnings", "net income"]):
        margin = (total_profit / total_rev * 100) if total_rev > 0 else 0.0
        today_margin = (today_profit / today_rev * 100) if today_rev > 0 else 0.0
        reply = (
            f"**Profitability Breakdown:**\n\n"
            f"- **Today's Profit:** **₹{today_profit:.2f}** ({today_margin:.1f}% margin on ₹{today_rev:.2f} revenue)\n"
            f"- **All-Time Profit:** **₹{total_profit:.2f}** ({margin:.1f}% margin on ₹{total_rev:.2f} revenue)\n\n"
            f"*Profit is calculated automatically as `Selling Price - Purchase Cost` for every item sold.*"
        )
        return ChatResponse(reply=reply)

    # Top selling product
    if any(w in query_lower for w in ["top", "best sell", "best product", "most popular", "bestseller", "highest sold"]):
        if not top_products:
            reply = "No items have been sold yet. Once you ring up bills in Sales Checkout, I will track your bestsellers here."
        else:
            lines = []
            for i, p in enumerate(top_products[:5], 1):
                lines.append(f"#{i} **{p['name']}** (`{p['code']}`): **{p['qty']} units sold** (₹{p['rev']:.2f} revenue)")
            reply = "**Top Selling Products Ranking:**\n\n" + "\n".join(lines)
        return ChatResponse(reply=reply)

    # Inventory valuation & product count
    if any(w in query_lower for w in ["inventory", "valuation", "worth", "stock value", "how many items", "catalog"]):
        retail_val = sum(p.stock_quantity * p.selling_price for p in active_products)
        cost_val = sum(p.stock_quantity * (p.purchase_cost or 0.0) for p in active_products)
        total_units = sum(p.stock_quantity for p in active_products)
        reply = (
            f"**Store Inventory Valuation:**\n\n"
            f"- Total In-Stock Units: **{total_units} units**\n"
            f"- Active Products: **{len(active_products)} products**\n"
            f"- Retail Value (Selling Price): **₹{retail_val:.2f}**\n"
            f"- Cost Value (Wholesale Cost): **₹{cost_val:.2f}**\n"
            f"- Potential Unrealized Profit: **₹{(retail_val - cost_val):.2f}**"
        )
        return ChatResponse(reply=reply)

    # Check specific product lookup (e.g. "stock of CC", "how many Coca-Cola", "price of Red Bull")
    for p in active_products:
        if p.code.lower() in query_lower or p.name.lower() in query_lower:
            status_text = "LOW STOCK" if p.stock_quantity <= p.low_stock_threshold else "Well Stocked"
            actions.append(ChatAction(
                type="restock",
                label=f"Adjust Stock for {p.name}",
                product_id=p.id,
                product_name=p.name,
                product_code=p.code
            ))
            reply = (
                f"**Product Details for {p.name}:**\n\n"
                f"- Code: `{p.code}`\n"
                f"- Category: **{p.category}**\n"
                f"- Current Stock: **{p.stock_quantity} {p.unit}s** ({status_text})\n"
                f"- Alert Level: **{p.low_stock_threshold} {p.unit}s**\n"
                f"- Selling Price: **₹{p.selling_price:.2f}** (Cost: ₹{p.purchase_cost:.2f})\n"
                f"- Margin per Unit: **₹{(p.selling_price - p.purchase_cost):.2f}**"
            )
            return ChatResponse(reply=reply, actions=actions)

    # Default general intelligent response
    reply = (
        f"I analyzed your store data for: *\"{user_query}\"*\n\n"
        f"Here is your current store snapshot:\n"
        f"- **Today's Revenue:** ₹{today_rev:.2f} ({len(today_sales)} bills)\n"
        f"- **All-Time Revenue:** ₹{total_rev:.2f}\n"
        f"- **Low Stock Items:** {len(low_stock)} item(s) needing attention\n"
        f"- **Total Active Products:** {len(active_products)}\n\n"
        f"Try asking:\n"
        f"- *'Which products should I restock?'*\n"
        f"- *'What is my profit today?'*\n"
        f"- *'Who is my top selling product?'*"
    )
    if low_stock:
        actions.append(ChatAction(
            type="restock",
            label=f"Restock {low_stock[0].name}",
            product_id=low_stock[0].id,
            product_name=low_stock[0].name,
            product_code=low_stock[0].code
        ))
    return ChatResponse(reply=reply, actions=actions)

# Helper to safely update .env file and process environment
def update_env_gemini_key(new_key: str):
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    lines = []
    found = False
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        new_lines = []
        for line in lines:
            if line.strip().startswith("GEMINI_API_KEY="):
                new_lines.append(f"GEMINI_API_KEY={new_key}\n")
                found = True
            else:
                new_lines.append(line)
        lines = new_lines

    if not found:
        lines.append(f"\n# Google Gemini AI Configuration\n# Get a free API key at: https://aistudio.google.com/app/apikey\nGEMINI_API_KEY={new_key}\n")

    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(lines)

    # Immediately reflect in current Python process
    os.environ["GEMINI_API_KEY"] = new_key

def mask_api_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 10:
        return "****"
    return f"{key[:6]}...{key[-4:]}"

# 16. Get current Gemini AI key status
@app.get("/api/config/gemini-key", response_model=GeminiConfigResponse)
def get_gemini_config():
    key = (os.getenv("GEMINI_API_KEY") or "").strip()
    is_configured = bool(key and key != "your_gemini_api_key_here")
    return GeminiConfigResponse(
        status="configured" if is_configured else "not_configured",
        message="Gemini API Key is active and configured." if is_configured else "No Gemini API Key configured.",
        configured=is_configured,
        masked_key=mask_api_key(key),
        api_key=key if is_configured else ""
    )

# 17. Save Gemini AI key and automatically reflect in .env
@app.post("/api/config/gemini-key", response_model=GeminiConfigResponse)
def save_gemini_config(config: GeminiConfigUpdate):
    key = config.api_key.strip()
    update_env_gemini_key(key)
    is_configured = bool(key)
    return GeminiConfigResponse(
        status="success",
        message="Gemini API key saved to .env successfully!" if is_configured else "Gemini API key cleared from .env.",
        configured=is_configured,
        masked_key=mask_api_key(key),
        api_key=key
    )

# 18. Test Gemini API key connection
@app.post("/api/config/gemini-key/test")
def test_gemini_key(config: GeminiConfigUpdate):
    key = config.api_key.strip() or (os.getenv("GEMINI_API_KEY") or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Please enter a Gemini API key to test.")
    
    for model_name in ["gemini-3.5-flash", "gemini-flash-latest"]:
        try:
            import requests
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
            payload = {"contents": [{"parts": [{"text": "Respond: Connection verified"}]}]}
            res = requests.post(url, json=payload, timeout=12)
            if res.status_code == 200:
                return {
                    "status": "success", 
                    "message": f"Connection verified successfully with Google {model_name}!"
                }
            elif res.status_code == 404:
                continue
            else:
                err_data = res.json()
                err_msg = err_data.get("error", {}).get("message", res.text)
                return {"status": "error", "message": f"Google error ({res.status_code}): {err_msg}"}
        except Exception as e:
            return {"status": "error", "message": f"Network request error: {str(e)}"}
    return {"status": "error", "message": "Could not connect to tested Gemini models."}

# Mount frontend files
app.mount("/", StaticFiles(directory="static", html=True), name="static")

