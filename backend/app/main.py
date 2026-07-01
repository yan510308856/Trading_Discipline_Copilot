"""FastAPI application entry point."""

from fastapi import FastAPI


app = FastAPI(title="Trading Discipline Copilot API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
