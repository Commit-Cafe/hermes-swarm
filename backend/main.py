import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS, API_HOST, API_PORT
from database import init_db
from routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    await init_db()

    glm_api_key = os.getenv("GLM_API_KEY", "")
    glm_base_url = os.getenv("GLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")
    glm_model = os.getenv("GLM_MODEL", "glm-5-turbo")

    if glm_api_key:
        from hermes_manager import set_glm_config
        set_glm_config(api_key=glm_api_key, base_url=glm_base_url, model=glm_model)
        logger.info(f"GLM API configured: model={glm_model}, base_url={glm_base_url}")
    else:
        logger.warning("GLM_API_KEY not set in .env - agent tasks will fail")

    logger.info("Hermes Swarm API starting up")
    yield
    logger.info("Hermes Swarm API shutting down")


app = FastAPI(
    title="Hermes Swarm API",
    version="0.1.0",
    description="Multi-Hermes-Agent orchestration and monitoring dashboard",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "Hermes Swarm API", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=True)
