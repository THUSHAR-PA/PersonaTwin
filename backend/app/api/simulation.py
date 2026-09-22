from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies.auth import ensure_user_owns_resource, get_current_user
from app.models.user import User
from app.services.simulation_service import (
    run_fitness_simulation,
    run_home_loan_simulation,
    run_higher_studies_simulation,
    run_investment_simulation,
    run_job_switch_simulation,
    run_sleep_simulation,
    run_startup_simulation,
    run_vehicle_purchase_simulation,
)

router = APIRouter(prefix="/simulation", tags=["Simulation"])


class SimulationRequest(BaseModel):
    domain: str
    simulation_type: str
    parameters: dict[str, Any] = Field(default_factory=dict)


@router.get("/health")
def simulation_health():
    return {"status": "ok", "service": "simulation"}


@router.post("/{user_id}")
def run_simulation(
    user_id: UUID,
    payload: SimulationRequest,
    current_user: User = Depends(get_current_user),
):
    ensure_user_owns_resource(user_id, current_user)

    simulations = {
        ("financial", "vehicle_purchase"): run_vehicle_purchase_simulation,
        ("financial", "home_loan"): run_home_loan_simulation,
        ("financial", "investment"): run_investment_simulation,
        ("career", "higher_studies"): run_higher_studies_simulation,
        ("career", "job_switch"): run_job_switch_simulation,
        ("career", "startup"): run_startup_simulation,
        ("health", "fitness"): run_fitness_simulation,
        ("health", "sleep"): run_sleep_simulation,
    }
    simulation = simulations.get((payload.domain, payload.simulation_type))
    if simulation is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported simulation type.",
        )

    try:
        return simulation(payload.parameters)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
