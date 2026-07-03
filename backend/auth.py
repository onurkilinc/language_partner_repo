from functools import lru_cache
from typing import Any

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from config import (
    COGNITO_APP_CLIENT_ID,
    COGNITO_APPROVED_VALUE,
    COGNITO_REGION,
    COGNITO_USER_ATTRIBUTE,
    COGNITO_USER_POOL_ID,
    auth_enabled,
)

bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache
def _jwks_client() -> PyJWKClient:
    jwks_url = (
        f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/"
        f"{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    )
    return PyJWKClient(jwks_url)


def verify_token(token: str) -> dict[str, Any]:
    issuer = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
    signing_key = _jwks_client().get_signing_key_from_jwt(token)
    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=COGNITO_APP_CLIENT_ID,
        issuer=issuer,
        options={"verify_aud": True},
    )

    user_status = payload.get(COGNITO_USER_ATTRIBUTE, "pending")
    if user_status != COGNITO_APPROVED_VALUE:
        raise HTTPException(status_code=403, detail="Account pending approval.")

    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    if not auth_enabled():
        return {"sub": "local-dev"}

    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token.")

    try:
        return verify_token(credentials.credentials)
    except HTTPException:
        raise
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc
