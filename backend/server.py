"""
PostSnap Python Proxy — DEV SHIM ONLY. DO NOT DEPLOY TO PRODUCTION.

Forwards all /api/* requests to the Node.js API running on port 4001.
Use only for local/dev setups that expect a Python entrypoint.
Production: deploy the Node/Express API (apps/api) directly with strict CORS;
do not use this proxy (it uses wildcard CORS and is not for production).
"""
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NODE_API = "http://127.0.0.1:4001"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy(path: str, request: Request):
    url = f"{NODE_API}/{path}"
    params = dict(request.query_params)

    try:
        body = await request.body()
        headers = {
            k: v for k, v in request.headers.items()
            if k.lower() not in ("host", "content-length")
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.request(
                method=request.method,
                url=url,
                params=params,
                content=body,
                headers=headers,
            )

        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=dict(resp.headers),
            media_type=resp.headers.get("content-type", "application/json"),
        )

    except httpx.ConnectError:
        logger.error(f"Cannot connect to Node API at {NODE_API}")
        return Response(
            content=b'{"error":true,"message":"Backend service unavailable"}',
            status_code=503,
            media_type="application/json",
        )
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        return Response(
            content=b'{"error":true,"message":"Proxy error"}',
            status_code=500,
            media_type="application/json",
        )
