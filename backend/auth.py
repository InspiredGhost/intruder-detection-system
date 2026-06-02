import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# Single demo user — in production, store hashed passwords in MongoDB.
# Override by setting ADMIN_USERNAME / ADMIN_PASSWORD_HASH env vars.
_DEMO_USER = os.getenv("ADMIN_USERNAME", "admin")
_DEMO_HASH = os.getenv(
    "ADMIN_PASSWORD_HASH",
    pwd_context.hash(os.getenv("ADMIN_PASSWORD", "changeme")),
)


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def authenticate_user(username: str, password: str) -> bool:
    return username == _DEMO_USER and verify_password(password, _DEMO_HASH)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
        username: str = payload.get("sub", "")
        if not username:
            raise credentials_exc
        return username
    except JWTError:
        raise credentials_exc


def verify_token(token: str) -> str:
    """Verify a raw JWT string and return username. For use with query-param auth."""
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
        username: str = payload.get("sub", "")
        if not username:
            raise ValueError
        return username
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
