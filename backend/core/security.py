import hmac

from fastapi import Header, HTTPException, Request, status


async def require_admin(request: Request, x_api_key: str | None = Header(default=None)) -> None:
    expected = request.app.state.container.settings.api_auth_secret
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Valid administrator API key required")

