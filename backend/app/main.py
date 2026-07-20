from fastapi import FastAPI

from app.api.users import router as user_router
from app.api.finance import router as finance_router
from app.api.career import router as career_router
from app.api.health import router as health_router
app = FastAPI(
    title="PersonaTwin API",
    version="1.0.0",
)
app.include_router(user_router)
app.include_router(finance_router)
app.include_router(career_router)
app.include_router(health_router)