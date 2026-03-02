"""
KisanCall — Email Service
Sends verification emails via Gmail SMTP using aiosmtplib
"""

import os
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
from dotenv import load_dotenv
from commons.logger import logger as get_logger

load_dotenv()

logger = get_logger(__name__)

EMAIL_FROM = os.getenv("EMAIL_FROM", "")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
APP_URL = os.getenv("APP_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def _build_verification_email(name: str, token: str) -> str:
    """Build the HTML body for the verification email."""
    verify_url = f"{APP_URL}/auth/verify-email?token={token}"
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }}
        .container {{ max-width: 580px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
        .header {{ background: linear-gradient(135deg, #0a2e1a 0%, #166534 100%); padding: 36px 32px; text-align: center; }}
        .header h1 {{ color: #f59e0b; margin: 0; font-size: 28px; letter-spacing: 1px; }}
        .header p {{ color: #86efac; margin: 6px 0 0; font-size: 14px; }}
        .body {{ padding: 36px 32px; }}
        .body h2 {{ color: #0a2e1a; font-size: 22px; margin: 0 0 12px; }}
        .body p {{ color: #444; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }}
        .btn {{ display: inline-block; background: linear-gradient(135deg, #16a34a, #15803d); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px; }}
        .footer {{ background: #f9fafb; padding: 20px 32px; text-align: center; color: #9ca3af; font-size: 12px; }}
        .link {{ color: #16a34a; word-break: break-all; font-size: 13px; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌾 KisanCall</h1>
          <p>Farmer Expert Tele-Consultation Platform</p>
        </div>
        <div class="body">
          <h2>Namaste, {name}! 🙏</h2>
          <p>Thank you for joining KisanCall. You're one step away from connecting with agriculture experts.</p>
          <p>Please verify your email address by clicking the button below:</p>
          <p style="text-align:center; margin: 28px 0;">
            <a href="{verify_url}" class="btn">✅ Verify Email Address</a>
          </p>
          <p style="color:#888; font-size:13px;">Or copy this link into your browser:</p>
          <p><a href="{verify_url}" class="link">{verify_url}</a></p>
          <p style="color:#888; font-size:13px; margin-top:24px;">This link will expire in 24 hours. If you did not create an account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          &copy; 2026 KisanCall &mdash; Empowering Indian Farmers 🌱
        </div>
      </div>
    </body>
    </html>
    """


async def send_verification_email(to_email: str, name: str, token: str) -> bool:
    """
    Send a beautifully branded HTML verification email.
    Returns True on success, False on failure.
    """
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "🌾 KisanCall — Verify Your Email Address"
        msg["From"] = f"KisanCall <{EMAIL_FROM}>"
        msg["To"] = to_email

        html_body = _build_verification_email(name, token)
        msg.attach(MIMEText(html_body, "html"))

        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=EMAIL_FROM,
            password=EMAIL_PASSWORD,
            start_tls=True,
            timeout=10,
        )

        logger.info(f"✅ Verification email sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to send email to {to_email}: {e}")
        return False
