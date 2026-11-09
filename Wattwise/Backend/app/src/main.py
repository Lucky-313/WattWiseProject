from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from Auth import router as auth_router
from Routers.sci_router import router as sci_router

app = FastAPI()

# Register Auth and Feature Routers
app.include_router(auth_router)
app.include_router(sci_router)

# Cors configuration
origins = [
    "http://localhost:5173",  # Vite development server
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
