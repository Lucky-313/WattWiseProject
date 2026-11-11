from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from Auth import router as auth_router
from Routers.dashboard_router import router as dashboard_router
from Routers.sci_router import router as sci_router
from database import initialize_database

app = FastAPI()

# Register Auth and Feature Routers
app.include_router(auth_router)
app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router)
app.include_router(sci_router)


@app.on_event("startup")
def initialize_app_database():
    initialize_database()

# Cors configuration
origins = [
    "http://localhost:5173",  # Vite development server
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
