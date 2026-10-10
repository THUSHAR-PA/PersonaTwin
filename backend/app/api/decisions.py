from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import ensure_user_owns_resource, get_current_user
from app.models import DecisionEvent, DecisionRun, TwinState, User
from app.schemas.decision import CaptureRequest, DecisionRequest, FeedbackRequest, HistoryImport, OutcomeRequest
from app.services.decision_service import evaluate_decision
from app.services.outcome_service import summarize_outcomes
from app.services.twin_state_service import capture_state, parse_monthly_history


def owner(user_id: UUID, user: User = Depends(get_current_user)):
    ensure_user_owns_resource(user_id, user)
    return user


router = APIRouter(prefix="/users/{user_id}/decisions", tags=["Decisions"], dependencies=[Depends(owner)])


def owned(db, model, user_id, record_id):
    record = db.query(model).filter_by(id=record_id, user_id=user_id).first()
    if not record:
        raise HTTPException(404, "Record not found.")
    return record


def state_response(state):
    return {"id": state.id, "created_at": state.created_at, "source": state.source, "data": state.data}


def run_response(run, detail=False):
    data = {"id": run.id, "state_id": run.state_id, "created_at": run.created_at, "scenario": run.scenario, "title": run.request["title"], "baseline": run.result["baseline"], "alternative": run.result["alternative"], "currency": run.result["currency"]}
    if detail:
        data["outcome_evaluation"] = summarize_outcomes(run.result, run.events)
        data.update({"request": run.request, "result": run.result, "events": [{"id": e.id, "kind": e.kind, "created_at": e.created_at, "data": e.data} for e in sorted(run.events, key=lambda e: e.created_at)]})
    return data


@router.post("/states", status_code=201)
def capture(user_id: UUID, payload: CaptureRequest, db: Session = Depends(get_db)):
    try:
        state = capture_state(db, user_id, currency=payload.currency)
        db.commit()
        return state_response(state)
    except ValueError as error:
        db.rollback()
        raise HTTPException(422, str(error))


@router.get("/states")
def states(user_id: UUID, limit: int = Query(30, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    return [state_response(s) for s in db.query(TwinState).filter_by(user_id=user_id).order_by(TwinState.created_at.desc()).offset(offset).limit(limit)]


@router.post("/history", status_code=201)
def import_history(user_id: UUID, payload: HistoryImport, db: Session = Depends(get_db)):
    try:
        state = capture_state(db, user_id, source="monthly_import", currency=payload.currency, history=parse_monthly_history(payload.csv_text), history_source=payload.source_name)
        db.commit()
        return state_response(state)
    except ValueError as error:
        db.rollback()
        raise HTTPException(422, str(error))


@router.post("/", status_code=201)
def create_decision(user_id: UUID, payload: DecisionRequest, db: Session = Depends(get_db)):
    state = owned(db, TwinState, user_id, payload.state_id)
    try:
        result = evaluate_decision(state.data, payload)
    except ValueError as error:
        raise HTTPException(422, str(error))
    except RuntimeError as error:
        raise HTTPException(503, str(error))
    run = DecisionRun(user_id=user_id, state_id=state.id, scenario=payload.scenario, request=payload.model_dump(mode="json"), result=result)
    db.add(run)
    db.commit()
    db.refresh(run)
    return run_response(run, True)


@router.get("/")
def decisions(user_id: UUID, limit: int = Query(30, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    return [run_response(r) for r in db.query(DecisionRun).filter_by(user_id=user_id).order_by(DecisionRun.created_at.desc()).offset(offset).limit(limit)]


@router.get("/{run_id}")
def decision(user_id: UUID, run_id: UUID, db: Session = Depends(get_db)):
    return run_response(owned(db, DecisionRun, user_id, run_id), True)


@router.post("/{run_id}/feedback", status_code=201)
def feedback(user_id: UUID, run_id: UUID, payload: FeedbackRequest, db: Session = Depends(get_db)):
    run = owned(db, DecisionRun, user_id, run_id)
    db.add(DecisionEvent(run_id=run.id, kind="feedback", data=payload.model_dump()))
    db.commit()
    return run_response(run, True)


@router.post("/{run_id}/outcomes", status_code=201)
def outcome(user_id: UUID, run_id: UUID, payload: OutcomeRequest, db: Session = Depends(get_db)):
    run = owned(db, DecisionRun, user_id, run_id)
    if payload.month > len(run.result["trajectory"]):
        raise HTTPException(422, "The observation is outside this decision's horizon.")
    point = run.result["trajectory"][payload.month - 1]
    if payload.observed_on.isoformat() != point["period_end"] or payload.observed_on > date.today():
        raise HTTPException(422, "Record a completed period using its exact month-end date.")
    data = payload.model_dump(mode="json")
    data["forecast_savings"] = point[payload.branch]
    data["error"] = round(payload.savings - point[payload.branch], 2)
    db.add(DecisionEvent(run_id=run.id, kind="outcome", data=data))
    db.commit()
    return run_response(run, True)


@router.delete("/{run_id}", status_code=204)
def delete_decision(user_id: UUID, run_id: UUID, db: Session = Depends(get_db)):
    db.delete(owned(db, DecisionRun, user_id, run_id))
    db.commit()
