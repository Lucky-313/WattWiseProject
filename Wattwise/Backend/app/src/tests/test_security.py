from datetime import datetime, timedelta, timezone
import os
import jwt
import pytest

os.environ["SECRET_KEY"] = "wattwise-testing-secret-key-123456789" # had to make the key long to avoid the test results being flooded with warnings for a short secret key

import Security as security_module
from Security import (
    hash_password,
    verify_password,
    create_access_token,
    verify_access_token,
    create_dashboard_access_token,
    verify_dashboard_access_token,
    create_password_reset_token,
    verify_password_reset_token,
)

# 1. Test password hashing and verification

def test_password_hashing():
    password = "Password12?"

    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


# 2. Test access token creation

def test_create_access_token():
    token = create_access_token(123)

    payload = jwt.decode(
        token, security_module.SECRET_KEY, algorithms=["HS256"]
    )

    assert payload["sub"] == "123"
    assert "exp" in payload
    assert "purpose" not in payload


# 3. Test access token verification

def test_verify_access_token():
    valid_token = create_access_token(123)
    dashboard_token = create_dashboard_access_token(123, 456)
    reset_token = create_password_reset_token(123)

    assert verify_access_token(valid_token) == 123
    assert verify_access_token("invalid-token") is None
    assert verify_access_token(dashboard_token) is None
    assert verify_access_token(reset_token) is None


# 4. Test dashboard access token verification

def test_verify_dashboard_access_token():
    token = create_dashboard_access_token(123, 456)

    assert verify_dashboard_access_token(token, 123, 456) is True
    assert verify_dashboard_access_token(token, 999, 456) is False
    assert verify_dashboard_access_token(token, 123, 999) is False
    assert verify_dashboard_access_token("invalid-token", 123, 456) is False


# 5. Test password reset token verification

def test_verify_password_reset_token():
    reset_token = create_password_reset_token(123)
    access_token = create_access_token(123)

    assert verify_password_reset_token(reset_token) == 123
    assert verify_password_reset_token(access_token) is None
    assert verify_password_reset_token("invalid-token") is None


# 6. Test expired access token

def test_expired_access_token():
    expired_payload = {
        "sub": "123",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=5)
    }

    token = jwt.encode(
        expired_payload,
        security_module.SECRET_KEY,
        algorithm="HS256"
    )

    assert verify_access_token(token) is None
