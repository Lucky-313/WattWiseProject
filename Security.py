import os
import jwt

from datetime import datetime, timedelta, timezone
from pwdlib import PasswordHash



# config password hashing
password_hash = PasswordHash.recommended()

# config JWT
SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY variable is not set")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# hash user's password before storing
def hash_password(password: str):
    return password_hash.hash(password)


# checks password against its hash
def verify_password(plain_password: str, hashed_password: str):
    return password_hash.verify(plain_password, hash_password)

# generate a JWT token
def create_access_token(user_id: int):
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {"sub": str(user_id), "exp": expire}

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return token


#Verify and decode JWT token
def verify_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id = payload.get("sub")

        if user_id is None:
            return None

        return int(user_id)

    except (jwt.InvalidTokenError, ValueError, TypeError):
        return None