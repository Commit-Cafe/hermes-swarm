import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DATABASE_PATH = DATA_DIR / "hermes_swarm.db"

WSL_HERMES_DIR = os.getenv("WSL_HERMES_DIR", "/root/hermes-agent")
WSL_VENV_ACTIVATE = f"{WSL_HERMES_DIR}/venv/bin/activate"
WSL_HERMES_CMD = "hermes chat -q"

HERMES_WORKSPACE = os.getenv("HERMES_WORKSPACE", "/root/hermes-agent")

MAX_CONCURRENT_AGENTS = int(os.getenv("MAX_CONCURRENT_AGENTS", "4"))
DEFAULT_TIMEOUT = int(os.getenv("DEFAULT_TIMEOUT", "3600"))

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8001"))

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:5173").split(",")
