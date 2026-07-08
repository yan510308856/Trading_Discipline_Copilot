"""FastAPI application entry point and shared error responses."""

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import router
from app.errors import APIError


app = FastAPI(title="Trading Discipline Copilot API")
app.include_router(router)


def error_response(
    status_code: int, code: str, message: str, details: dict
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(
            {"error": {"code": code, "message": message, "details": details}}
        ),
    )


@app.exception_handler(APIError)
def handle_api_error(request: Request, error: APIError) -> JSONResponse:
    return error_response(error.status_code, error.code, error.message, error.details)


@app.exception_handler(RequestValidationError)
def handle_validation_error(
    request: Request, error: RequestValidationError
) -> JSONResponse:
    return error_response(
        422,
        "VALIDATION_ERROR",
        "The request data is invalid.",
        {"errors": error.errors()},
    )


@app.exception_handler(StarletteHTTPException)
def handle_http_error(
    request: Request, error: StarletteHTTPException
) -> JSONResponse:
    return error_response(
        error.status_code,
        "HTTP_ERROR",
        str(error.detail),
        {},
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
