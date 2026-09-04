from fastapi import APIRouter

router = APIRouter(prefix="/simulation", tags=["Simulation"])


@router.get("/health")
def simulation_health():
    return {"status": "ok", "service": "simulation"}
