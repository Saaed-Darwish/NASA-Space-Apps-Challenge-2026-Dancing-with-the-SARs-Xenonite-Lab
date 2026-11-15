"""The legacy upload example has been replaced by the protected read-only API.

Run main:app (or serve_local.py) and use water_layers.router. Generate artifacts
with prepare_water_layers.py in .venv-raster. Public arbitrary-file uploads and
request-time raster processing are intentionally not exposed.
"""
from water_layers import router
