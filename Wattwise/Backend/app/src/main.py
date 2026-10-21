from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 🔓 Allow your React frontend to connect
origins = [
    "http://localhost:5173", # Vite's default local address
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)

@app.get("/api/data")
def read_root():
    return {"message": "Hello from the FastAPI backend!"}
