"""Configurable price-alert email delivery without provider lock-in."""

from __future__ import annotations

import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol

from app import models


def env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class EmailSettings:
    enabled: bool
    recipient: str
    host: str
    port: int
    username: str
    password: str
    from_email: str
    use_tls: bool
    app_base_url: str

    @classmethod
    def from_env(cls) -> "EmailSettings":
        return cls(
            enabled=env_bool("EMAIL_NOTIFICATIONS_ENABLED"),
            recipient=os.getenv("ALERT_RECIPIENT_EMAIL", "").strip(),
            host=os.getenv("SMTP_HOST", "").strip(),
            port=int(os.getenv("SMTP_PORT", "587")),
            username=os.getenv("SMTP_USERNAME", "").strip(),
            password=os.getenv("SMTP_PASSWORD", ""),
            from_email=os.getenv("SMTP_FROM_EMAIL", "").strip(),
            use_tls=env_bool("SMTP_USE_TLS", True),
            app_base_url=os.getenv("APP_BASE_URL", "http://localhost:3000").rstrip("/"),
        )

    @property
    def smtp_configured(self) -> bool:
        return bool(self.host and self.from_email)


class EmailSender(Protocol):
    provider_name: str
    def send_price_alert(self, trade: models.Trade, event: models.TradePriceAlertEvent) -> None: ...
    def send_test_email(self) -> None: ...


class DisabledEmailSender:
    provider_name = "disabled"
    def send_price_alert(self, trade: models.Trade, event: models.TradePriceAlertEvent) -> None:
        return None
    def send_test_email(self) -> None:
        return None


class SmtpEmailSender:
    provider_name = "smtp"

    def __init__(self, settings: EmailSettings) -> None:
        self.settings = settings

    def _send(self, subject: str, body: str) -> None:
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = self.settings.from_email
        message["To"] = self.settings.recipient
        message.set_content(body)
        with smtplib.SMTP(self.settings.host, self.settings.port, timeout=10) as smtp:
            if self.settings.use_tls:
                smtp.starttls()
            if self.settings.username:
                smtp.login(self.settings.username, self.settings.password)
            smtp.send_message(message)

    def send_price_alert(self, trade: models.Trade, event: models.TradePriceAlertEvent) -> None:
        label = event.alert_kind.replace("_", " ").title()
        subject = f"[Trading Discipline] {trade.symbol} reached {label} at {event.normalized_threshold_price}"
        body = "\n".join([
            f"Symbol: {trade.symbol}", f"Trade ID: {trade.id}",
            f"Horizon: {trade.trade_horizon}", f"Market: {trade.market}",
            f"Direction: {trade.direction}", f"Alert type: {label}",
            f"Threshold price: {event.normalized_threshold_price}",
            f"Observed price: {event.observed_price:.2f}",
            f"Active stop: {(trade.current_stop if trade.current_stop is not None else trade.stop_loss):.2f}",
            f"Target 1: {trade.target_1:.2f}",
            f"Target 2: {trade.target_2:.2f}" if trade.target_2 is not None else "Target 2: —",
            f"Triggered time: {event.triggered_at.isoformat()}",
            f"Open Trades: {self.settings.app_base_url}/#open-trades",
        ])
        self._send(subject, body)

    def send_test_email(self) -> None:
        self._send("[Trading Discipline] Email configuration test", "Email notifications are configured.")


def configured_email_sender(settings: EmailSettings | None = None) -> EmailSender:
    settings = settings or EmailSettings.from_env()
    if settings.enabled and settings.recipient and settings.smtp_configured:
        return SmtpEmailSender(settings)
    return DisabledEmailSender()
