import logging
from contextlib import asynccontextmanager
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from daylog.config import settings
from daylog.db import SessionLocal
from daylog.rollover import rollover_all

logger = logging.getLogger(__name__)


def midnight_rollover():
    logger.info("Running midnight rollover")
    db = SessionLocal()
    try:
        today = date.today()
        workspaces_processed, total_items = rollover_all(db, today)
        logger.info(f"Rollover complete: {workspaces_processed} workspaces, {total_items} items rolled")
    except Exception:
        logger.exception("Rollover failed")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(midnight_rollover, CronTrigger(hour=0, minute=0), id="midnight-rollover")
    scheduler.start()
    logger.info("Scheduler started")
    yield
    scheduler.shutdown()
    logger.info("Scheduler stopped")


app = FastAPI(title="Daylog", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from daylog.router import auth, days, items, rollover, workspaces  # noqa: E402

app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(days.router)
app.include_router(items.router)
app.include_router(rollover.router)
