# AI-Powered Smart Shop Management Dashboard

A full-featured Point of Sale (POS), Inventory Management, and Store Analytics Dashboard with an integrated Google Gemini AI Store Assistant.

Built with **FastAPI**, **PostgreSQL**, **SQLAlchemy**, and Vanilla **HTML/CSS/JavaScript**.

---

## Features

- **Store Overview & Analytics Recap**: Real-time sales metrics, revenue, daily bill counts, top-selling products, and low-stock alerts.
- **Stock Management**: Add products, track live quantities, record stock movements (deliveries or damaged/expired items), and archive discontinued items.
- **POS Billing & Customer Receipts**: Quick product lookup by code (e.g., `CC`), live total calculation, bill generation, and printable receipts.
- **Floating "Ask AI" Assistant**: Fixed bottom-right chatbot powered by **Google Gemini** providing live inventory analysis, restock and business suggestions, and revenue insights.

---

## Quick Start with Docker (Recommended)

Run the entire application (FastAPI backend + PostgreSQL database) with a single command:

### 1. Clone the repository
```bash
git clone https://github.com/Dratt03/Ai-powered-smart-shop-management-dashboard.git
cd Smart_Dashboard
```

### 2. Prepare Environment File
Copy the example environment template:
```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```
Open `.env` and set `POSTGRES_PASSWORD` before starting Docker. Docker requires this variable to initialize and secure the PostgreSQL database container.

*(Optional: Set your `GEMINI_API_KEY` in `.env`, or configure it later through the dashboard UI).*

### 3. Start Containers
```bash
docker compose up --build
```

Open your browser at **[http://localhost:8000](http://localhost:8000)**.

To stop the containers:
```bash
docker compose down
```

---

## Local Setup (Without Docker)

### Prerequisites
- Python 3.10+
- PostgreSQL server installed and running

### 1. Create Virtual Environment & Install Dependencies
```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Mac / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure `.env`
Ensure your PostgreSQL database `shopkeeper_db` exists, then configure your `.env`:
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/shopkeeper_db
GEMINI_API_KEY=your_gemini_key_here
```

### 3. Run the Server
```bash
uvicorn main:app --reload --port 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser. All database tables will be created automatically on startup (inventory starts clean and empty ready for your custom items).

---

## Environment Variables

| Variable | Description | Example | Required For |
| :--- | :--- | :--- | :--- |
| `POSTGRES_PASSWORD` | Password for PostgreSQL user (`postgres`). **Must be set before starting Docker.** | `your_secure_password` | Docker Setup |
| `DATABASE_URL` | Full PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/shopkeeper_db` | Local / Standalone |
| `GEMINI_API_KEY` | Google Gemini API key from AI Studio | `AIzaSy...` | AI Assistant (Optional) |

---

## Tech Stack

- **Backend**: FastAPI, Uvicorn, Pydantic
- **Database & ORM**: PostgreSQL, SQLAlchemy 2.0, Psycopg
- **AI Integration**: Google Generative AI (Gemini 3.5 Flash / Flash Latest)
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript
- **DevOps**: Docker, Docker Compose
