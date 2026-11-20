import os
import resend
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

print("ENV path:", Path(__file__).resolve().parents[1] / ".env")
print("API key loaded:", bool(os.getenv("RESEND_API_KEY")))
print("Test email loaded:", bool(os.getenv("RESEND_TEST_EMAIL")))

# Configure Resend
resend.api_key = os.getenv("RESEND_API_KEY")

TEST_EMAIL = os.getenv("RESEND_TEST_EMAIL")
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173"
)

def send_password_reset_email(reset_token:str):

    if not resend.api_key:
        raise RuntimeError("APIemail config is missing")

    if not TEST_EMAIL:
        raise RuntimeError("test email not work")

    reset_link = (f"{FRONTEND_URL}/reset-password?token={reset_token}")

    params = {
        "from": "WattWise <onboarding@resend.dev>",
        "to": [TEST_EMAIL],
        "subject": "WattWise Password Reset",
        "html": f"""
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your WattWise password</p>
            <p>Click the link below to choose a new password:</p>
            <a href="{reset_link}">Reset Password</a>
            <p>This link expires in 30 minutes.</p>
        """,
        "text": f"Reset your WattWise password here: {reset_link}"
    }

    try:
        response = resend.Emails.send(params)
        return response

    except Exception as error:
        print(f"failed to send password reset email: {error}")
        raise