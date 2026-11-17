"""An endpoint dict whose connection test has passed for its current configuration (what the capability gate wants)."""
from lapp.services.capabilities import config_hash


def passed_endpoint(endpoint: dict) -> dict:
    return {**endpoint, "test": {"passed": True, "at": "2026-11-17T00:00:00", "config_hash": config_hash(endpoint)}}
