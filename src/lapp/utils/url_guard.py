"""SSRF guard for the endpoint URLs learners type in (S8): the server calls them, so they must not reach the cloud metadata
service or the link-local range, and only speak http(s). LAN and Docker addresses stay allowed by default (a local LLM or TTS
server is the normal case); set LAPP_ALLOW_PRIVATE_ENDPOINTS=0 on a shared deployment to block private and loopback ranges too."""
import ipaddress
import os
import socket
from urllib.parse import urlparse

_METADATA_HOSTS = {"metadata.google.internal", "metadata", "instance-data"}


def private_endpoints_allowed() -> bool:
    return os.environ.get("LAPP_ALLOW_PRIVATE_ENDPOINTS", "1").strip().lower() not in ("0", "false", "no")


def _addresses(host: str) -> list[ipaddress._BaseAddress]:
    try:
        return [ipaddress.ip_address(host)]
    except ValueError:
        pass
    try:
        return [ipaddress.ip_address(info[4][0]) for info in socket.getaddrinfo(host, None)]
    except OSError:
        return []          # does not resolve: the call itself will fail with its own message


def check_endpoint_url(url: str, allow_private: bool | None = None) -> None:
    """ValueError for a URL the server must not call: other schemes, no host, the metadata service, link-local addresses and,
    unless private endpoints are allowed, private and loopback ones."""
    allow_private = private_endpoints_allowed() if allow_private is None else allow_private
    parsed = urlparse((url or "").strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("the URL must start with http:// or https://")
    host = parsed.hostname.lower()
    if host in _METADATA_HOSTS:
        raise ValueError("this address is not allowed")
    for addr in _addresses(host):
        if addr.is_link_local or addr == ipaddress.ip_address("169.254.169.254"):
            raise ValueError("this address is not allowed")
        if not allow_private and (addr.is_private or addr.is_loopback):
            raise ValueError("private network addresses are not allowed on this server")
