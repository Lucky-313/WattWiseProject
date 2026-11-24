import os

os.environ["SECRET_KEY"] = "wattwise-integration-test-secret-key-123456789"

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

import database
import Auth
from main import app
from Security import create_access_token, create_password_reset_token


@pytest.fixture
def client(tmp_path, monkeypatch):
    test_engine = create_engine(
        f"sqlite:///{tmp_path / 'auth_test.db'}"
    )

    monkeypatch.setattr(database, "engine", test_engine)

    database.Base.metadata.create_all(test_engine)

    with TestClient(app) as test_client:
        yield test_client

    test_engine.dispose()


def register_user(client):
    return client.post(
        "/api/auth/signup",
        json={
            "name": "Test User",
            "email": "test@example.com",
            "password": "Password123!"
        }
    )


# 1. Test user registration

def test_register_user(client):
    response = register_user(client)

    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"
    assert response.json()["user_id"] is not None
    assert response.json()["access_token"] is not None


# 2. Test duplicate registration

def test_register_duplicate_user(client):
    register_user(client)

    response = register_user(client)

    assert response.status_code == 409
    assert response.json()["detail"] == "Email is already registered"


# 3. Test successful login

def test_login_success(client):
    register_user(client)

    response = client.post(
        "/api/auth/login",
        json={
            "email": "test@example.com",
            "password": "Password123!"
        }
    )

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert response.json()["token_type"] == "bearer"


# 4. Test invalid login credentials

@pytest.mark.parametrize(
    "email, password",
    [
        ("test@example.com", "WrongPassword123!"),
        ("unknown@example.com", "Password123!")
    ]
)
def test_login_invalid_credentials(client, email, password):
    register_user(client)

    response = client.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": password
        }
    )

    assert response.status_code == 401


# 5. Test retrieving the current user

def test_get_current_user(client):
    registration = register_user(client)
    user_id = registration.json()["user_id"]

    token = registration.json()["access_token"]

    response = client.get(
        "/api/auth/user",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["user_id"] == user_id
    assert response.json()["email"] == "test@example.com"

    # Missing authentication
    missing_token = client.get("/api/auth/user")
    assert missing_token.status_code in (401, 403)

    # Invalid authentication
    invalid_token = client.get(
        "/api/auth/user",
        headers={"Authorization": "Bearer invalid-token"}
    )
    assert invalid_token.status_code == 401


# 6. Test forgotten password request

def test_forgot_password(client):
    register_user(client)

    with patch("Auth.send_password_reset_email") as mock_email:
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "test@example.com"}
        )

        assert response.status_code == 200
        mock_email.assert_called_once()

    # Unknown email should receive the same response
    with patch("Auth.send_password_reset_email") as mock_email:
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "unknown@example.com"}
        )

        assert response.status_code == 200
        mock_email.assert_not_called()


# 7. Test password reset

def test_reset_password(client):
    registration = register_user(client)
    user_id = registration.json()["user_id"]

    reset_token = create_password_reset_token(user_id)

    response = client.post(
        "/api/auth/reset-password",
        json={
            "token": reset_token,
            "new_password": "NewPassword123!"
        }
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Password successfully reset"

    # Confirm the new password works
    login = client.post(
        "/api/auth/login",
        json={
            "email": "test@example.com",
            "password": "NewPassword123!"
        }
    )

    assert login.status_code == 200
    assert login.json()["access_token"]

    # Confirm the old password no longer works
    old_login = client.post(
        "/api/auth/login",
        json={
            "email": "test@example.com",
            "password": "Password123!"
        }
    )

    assert old_login.status_code == 401
