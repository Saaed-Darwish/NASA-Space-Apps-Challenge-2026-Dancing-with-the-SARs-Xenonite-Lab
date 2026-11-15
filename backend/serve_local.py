"""Serve the built frontend and API together for a local-network demonstration."""

import argparse
import ipaddress
import mimetypes
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
import uvicorn


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="This computer's explicit IPv4 address")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    try:
        address = ipaddress.IPv4Address(args.host)
    except ipaddress.AddressValueError:
        parser.error("Use an explicit IPv4 address, such as 127.0.0.1 or your Wi-Fi address")
    if address.is_unspecified or address.is_multicast or not address.is_private:
        parser.error("Use a loopback or private LAN address")
    if not 1 <= args.port <= 65535:
        parser.error("Port must be between 1 and 65535")

    root = Path(__file__).resolve().parent
    dist = root.parent / "frontend" / "dist"
    if not (dist / "index.html").is_file():
        parser.error("Build the frontend first: cd frontend, then npm run build")
    load_dotenv(root / ".env")
    origins = [value.strip() for value in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if value.strip()]
    origins.append(f"http://{address}:{args.port}")
    os.environ["CORS_ORIGINS"] = ",".join(dict.fromkeys(origins))

    # Configure the origin before main constructs its request guard.
    from main import app

    # Windows registry associations can otherwise label JavaScript as text/plain.
    mimetypes.init()
    for extension, content_type in {
        ".js": "text/javascript", ".mjs": "text/javascript",
        ".css": "text/css", ".json": "application/json",
        ".wasm": "application/wasm", ".svg": "image/svg+xml",
    }.items():
        mimetypes.add_type(content_type, extension)
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
    uvicorn.run(app, host=str(address), port=args.port)


if __name__ == "__main__":
    main()
