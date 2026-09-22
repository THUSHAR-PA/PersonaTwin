from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.career import router as career_router
from app.api.finance import router as finance_router
from app.api.health import router as health_router
from app.api.simulation import router as simulation_router
from app.api.twin import router as twin_router
from app.api.users import router as user_router

app = FastAPI(
    title="PersonaTwin API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(finance_router)
app.include_router(career_router)
app.include_router(health_router)
app.include_router(simulation_router)
app.include_router(twin_router)
app.include_router(auth_router)
