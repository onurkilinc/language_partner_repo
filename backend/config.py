import os

from dotenv import load_dotenv

load_dotenv()
load_dotenv("../.env")

COGNITO_REGION = os.getenv("COGNITO_REGION", "ca-central-1")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID", "")
AUTH_DISABLED = os.getenv("AUTH_DISABLED", "").lower() == "true"
COGNITO_USER_ATTRIBUTE = os.getenv("COGNITO_USER_ATTRIBUTE", "custom:user")
COGNITO_APPROVED_VALUE = os.getenv("COGNITO_APPROVED_VALUE", "approved")

DEFAULT_ORIGINS = "http://localhost:5173,http://localhost:3000"


def get_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def auth_enabled() -> bool:
    return bool(COGNITO_USER_POOL_ID and COGNITO_APP_CLIENT_ID) and not AUTH_DISABLED
