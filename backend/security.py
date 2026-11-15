"""Small ASGI guard for the local JSON API; deployment still needs authentication."""

from starlette.responses import JSONResponse

MAX_REQUEST_BYTES = 160_000  # Fits all permitted ChatRequest fields, including UTF-8 history.


class RequestGuard:
    def __init__(self, app, allowed_origins):
        self.app = app
        self.allowed_origins = frozenset(allowed_origins)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def secure_send(message):
            if message["type"] == "http.response.start":
                message = {**message, "headers": list(message.get("headers", [])) + [
                    (b"x-content-type-options", b"nosniff"),
                    (b"referrer-policy", b"no-referrer"),
                ]}
                if scope["path"] == "/api/chat":
                    message["headers"].append((b"cache-control", b"no-store"))
            await send(message)

        if scope["method"] not in ("POST", "PUT", "PATCH", "DELETE"):
            return await self.app(scope, receive, secure_send)

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        origin = headers.get(b"origin")
        if origin is not None and origin.decode("latin-1") not in self.allowed_origins:
            return await JSONResponse({"detail": "Browser origin is not allowed."}, 403)(scope, receive, secure_send)
        if scope["path"] == "/api/chat" and headers.get(b"content-type", b"").split(b";", 1)[0].strip().lower() != b"application/json":
            return await JSONResponse({"detail": "Use application/json."}, 415)(scope, receive, secure_send)
        if b"content-length" in headers:
            try:
                length = int(headers[b"content-length"])
            except ValueError:
                length = -1
            if length < 0:
                return await JSONResponse({"detail": "Invalid content length."}, 400)(scope, receive, secure_send)
            if length > MAX_REQUEST_BYTES:
                return await JSONResponse({"detail": "Request body is too large."}, 413)(scope, receive, secure_send)

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > MAX_REQUEST_BYTES:
                return await JSONResponse({"detail": "Request body is too large."}, 413)(scope, receive, secure_send)
            if not message.get("more_body", False):
                break

        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, secure_send)
