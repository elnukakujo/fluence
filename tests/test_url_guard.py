"""SSRF guard and key redaction (S8)."""
import pytest

from lapp.utils.model_api import ModelAPIError, redact
from lapp.utils.url_guard import check_endpoint_url


@pytest.mark.parametrize("url", ["ftp://x.test", "file:///etc/passwd", "javascript:alert(1)", "http://", "", "gopher://127.0.0.1",
                                 "http://169.254.169.254/latest/meta-data", "http://169.254.10.10", "http://[fe80::1]/", "http://metadata.google.internal/"])
def test_always_blocked(url):
    with pytest.raises(ValueError):
        check_endpoint_url(url, allow_private=True)


@pytest.mark.parametrize("url", ["http://192.168.1.139:8880/v1", "http://localhost:11434", "http://127.0.0.1:5000", "http://10.0.0.5", "https://api.openai.com/v1"])
def test_lan_and_public_allowed_when_configured(url):
    check_endpoint_url(url, allow_private=True)


@pytest.mark.parametrize("url", ["http://192.168.1.139:8880/v1", "http://localhost:11434", "http://127.0.0.1", "http://10.0.0.5"])
def test_private_blocked_when_disabled(url):
    with pytest.raises(ValueError, match="private"):
        check_endpoint_url(url, allow_private=False)


def test_env_switch(monkeypatch):
    monkeypatch.setenv("LAPP_ALLOW_PRIVATE_ENDPOINTS", "0")
    with pytest.raises(ValueError):
        check_endpoint_url("http://192.168.0.2")
    monkeypatch.setenv("LAPP_ALLOW_PRIVATE_ENDPOINTS", "1")
    check_endpoint_url("http://192.168.0.2")


def test_errors_never_carry_a_key():
    url = "https://texttospeech.googleapis.com/v1/text:synthesize?key=AIza-secret-123&alt=json"
    err = ModelAPIError(ModelAPIError.KIND_CONNECT, None, f"Cannot reach server: {url}", url)
    assert "AIza-secret-123" not in err.url and "AIza-secret-123" not in err.message and "AIza-secret-123" not in str(err)
    assert "key=" in err.url and "alt=json" in err.url                      # the shape stays readable
    assert redact("no secrets here") == "no secrets here"
