"""HTTP client for API-backed model tasks (text-gen, feedback, TTS).

Targets OpenAI-compatible + native Anthropic + native Gemini. Most providers
(OpenAI, DeepSeek, Ollama, Kimi, Groq, Mistral, OpenRouter, llama.cpp, ...)
speak OpenAI-compatible — one path covers them all.

There is no server-wide default — each user configures their own API in Settings.
A task is skipped when a user hasn't configured one.
"""
import base64
import logging
import os
import struct

import httpx

from .llm_providers import auth_headers

logger = logging.getLogger(__name__)

# Log proxy env vars once at import time — proxy interference is a common
# footgun on macOS where system-wide proxy settings leak into Python subprocess
# environments and can't route to LAN addresses.
_proxy_vars = {k: os.environ[k] for k in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY") if k in os.environ}
if _proxy_vars:
    logger.info("Proxy env vars detected: %s — will be ignored (trust_env=False)", _proxy_vars)

_TIMEOUT_SECONDS = 60


def _client(base_url: str, headers: dict) -> httpx.Client:
    """Create an httpx client that ignores proxy env vars.

    trust_env=False prevents httpx from picking up HTTP_PROXY / ALL_PROXY etc.
    Proxies can't route to LAN addresses like 192.168.x.x — this caused
    [Errno 65] No route to host for local LLM servers.
    """
    return httpx.Client(base_url=base_url, headers=headers, timeout=_TIMEOUT_SECONDS, trust_env=False)


class ModelAPIError(Exception):
    """Structured error from an LLM provider call.

    Callers can match on .kind to produce user-facing messages without
    parsing raw exception strings.
    """

    KIND_CONNECT = "connect"       # DNS / TCP / timeout — server unreachable
    KIND_AUTH = "auth"             # 401, 403 — bad key
    KIND_NOT_FOUND = "not_found"   # 404 — wrong URL path (missing /v1?)
    KIND_SERVER = "server"         # 5xx — provider-side failure
    KIND_CLIENT = "client"         # other 4xx — bad request shape
    KIND_UNKNOWN = "unknown"       # anything else

    def __init__(self, kind: str, status: int | None, message: str, url: str = ""):
        self.kind = kind
        self.status = status
        self.message = message
        self.url = url
        super().__init__(message)

    @classmethod
    def from_httpx(cls, exc: httpx.HTTPStatusError) -> "ModelAPIError":
        status = exc.response.status_code
        url = str(exc.request.url)
        if status == 404:
            hint = ". Does the base URL include /v1?" if "/v1" not in url else ""
            return cls(cls.KIND_NOT_FOUND, status, f"Endpoint not found (404){hint}", url)
        if status in (401, 403):
            return cls(cls.KIND_AUTH, status, f"Authentication failed ({status})", url)
        if 400 <= status < 500:
            return cls(cls.KIND_CLIENT, status, f"Client error ({status}): {exc.response.text[:200]}", url)
        if 500 <= status < 600:
            return cls(cls.KIND_SERVER, status, f"Server error ({status})", url)
        return cls(cls.KIND_UNKNOWN, status, str(exc), url)

    @classmethod
    def from_connection(cls, exc: Exception, url: str = "") -> "ModelAPIError":
        msg = str(exc)
        if "No route to host" in msg:
            return cls(cls.KIND_CONNECT, None,
                       "Cannot reach server — proxy or VPN may be blocking LAN addresses (try disabling HTTP_PROXY)", url)
        if "Name or service not known" in msg or "getaddrinfo" in msg.lower():
            return cls(cls.KIND_CONNECT, None, f"Host not found — check the base URL", url)
        if "timeout" in msg.lower() or "timed out" in msg.lower():
            return cls(cls.KIND_CONNECT, None, "Connection timed out — check the host and port", url)
        if "Connection refused" in msg:
            return cls(cls.KIND_CONNECT, None, "Connection refused — is the server running on that port?", url)
        return cls(cls.KIND_CONNECT, None, f"Cannot reach server: {msg}", url)


# ── OpenAI-compatible (default path for 90% of providers) ────────────────────

def _chat_completion_openai(
    base_url: str,
    api_key: str,
    auth_type: str,
    model: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float = 0.4,
    top_p: float = 0.9,
    *,
    timeout: float = 60,
    disable_thinking: bool = False,
) -> str:
    url, headers = auth_headers(base_url, api_key, auth_type)
    body = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": top_p,
    }
    # llama.cpp hint for Qwen3-style reasoning models: disable the hidden
    # "thinking" pass so they answer directly instead of burning the whole token
    # budget on <reasoning> and returning empty content (finish_reason=length).
    # Other OpenAI-compatible servers ignore this field. Opt-in only — the same
    # model is used for feedback etc. where thinking is wanted.
    if disable_thinking:
        body["chat_template_kwargs"] = {"enable_thinking": False}
    with httpx.Client(base_url=url, headers=headers, timeout=timeout, trust_env=False) as client:
        resp = client.post("/chat/completions", json=body)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def _synthesize_speech_openai(
    base_url: str,
    api_key: str,
    auth_type: str,
    model: str = "",
    text: str = "",
    voice: str = "alloy",
) -> bytes:
    body: dict = {"input": text, "voice": voice}
    if model:
        body["model"] = model
    if model:
        body["response_format"] = "wav"
    url, headers = auth_headers(base_url, api_key, auth_type)
    with _client(url, headers) as client:
        resp = client.post("/audio/speech", json=body)
        resp.raise_for_status()
        return resp.content


# ── Anthropic (Claude) ────────────────────────────────────────────────────────

def _split_data_url(url: str) -> tuple[str, str]:
    """"data:image/png;base64,XXXX" -> ("image/png", "XXXX"). Only data URLs: we never fetch remote images."""
    head, sep, data = url.partition(",")
    if not (head.startswith("data:") and head.endswith(";base64") and sep):
        raise ModelAPIError(ModelAPIError.KIND_CLIENT, None, "Images must be sent as base64 data URLs for this provider")
    return head[5:-7] or "image/png", data


def _anthropic_content(content):
    """OpenAI-style content (str or parts list) -> Anthropic content blocks."""
    if isinstance(content, str):
        return content
    blocks = []
    for part in content:
        if part.get("type") == "image_url":
            media_type, data = _split_data_url(part["image_url"]["url"])
            blocks.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}})
        else:
            blocks.append({"type": "text", "text": part.get("text", "")})
    return blocks


def _gemini_parts(content):
    """OpenAI-style content (str or parts list) -> Gemini parts."""
    if isinstance(content, str):
        return [{"text": content}]
    parts = []
    for part in content:
        if part.get("type") == "image_url":
            media_type, data = _split_data_url(part["image_url"]["url"])
            parts.append({"inline_data": {"mime_type": media_type, "data": data}})
        else:
            parts.append({"text": part.get("text", "")})
    return parts


def _chat_completion_anthropic(
    base_url: str,
    api_key: str,
    auth_type: str,
    model: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float = 0.4,
    top_p: float = 0.9,
    *,
    timeout: float = 60,
) -> str:
    url, headers = auth_headers(base_url, api_key, auth_type)
    headers["anthropic-version"] = "2023-06-01"

    # Anthropic separates the system prompt from the message list
    system = None
    cleaned = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            cleaned.append({"role": m["role"], "content": _anthropic_content(m["content"])})

    body: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": cleaned,
    }
    if system:
        body["system"] = system
    if temperature:
        body["temperature"] = temperature
    if top_p:
        body["top_p"] = top_p

    with httpx.Client(base_url=url, headers=headers, timeout=timeout, trust_env=False) as client:
        resp = client.post("/messages", json=body)
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]


# ── Google Gemini ─────────────────────────────────────────────────────────────

def _chat_completion_gemini(
    base_url: str,
    api_key: str,
    auth_type: str,
    model: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float = 0.4,
    top_p: float = 0.9,
    *,
    timeout: float = 60,
) -> str:
    url, headers = auth_headers(base_url, api_key, auth_type)

    # Translate OpenAI-format messages → Gemini contents[]
    contents = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": _gemini_parts(m["content"])})

    body = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": temperature,
            "topP": top_p,
        },
    }

    with httpx.Client(base_url=url, headers=headers, timeout=timeout, trust_env=False) as client:
        resp = client.post(f"/models/{model}:generateContent", json=body)
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


# ── Public dispatch ───────────────────────────────────────────────────────────

def chat_completion(
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float = 0.4,
    top_p: float = 0.9,
    api_format: str = "openai",
    auth_type: str = "bearer",
    *,
    timeout: float = 60,
    disable_thinking: bool = False,
) -> str:
    """Send a chat completion request. Dispatches on api_format.

    Raises ModelAPIError on transport/auth/API failures so callers can
    produce user-facing messages without parsing raw exception strings.
    """
    try:
        if api_format == "anthropic":
            return _chat_completion_anthropic(
                base_url=base_url, api_key=api_key, auth_type=auth_type,
                model=model, messages=messages, max_tokens=max_tokens,
                temperature=temperature, top_p=top_p, timeout=timeout,
            )
        elif api_format == "gemini":
            return _chat_completion_gemini(
                base_url=base_url, api_key=api_key, auth_type=auth_type,
                model=model, messages=messages, max_tokens=max_tokens,
                temperature=temperature, top_p=top_p, timeout=timeout,
            )
        else:
            return _chat_completion_openai(
                base_url=base_url, api_key=api_key, auth_type=auth_type,
                model=model, messages=messages, max_tokens=max_tokens,
                temperature=temperature, top_p=top_p, timeout=timeout,
                disable_thinking=disable_thinking,
            )
    except ModelAPIError:
        raise
    except httpx.HTTPStatusError as e:
        raise ModelAPIError.from_httpx(e) from e
    except httpx.RequestError as e:
        raise ModelAPIError.from_connection(e, url=base_url) from e
    except Exception as e:
        raise ModelAPIError(
            ModelAPIError.KIND_UNKNOWN, None, str(e), url=base_url,
        ) from e


def _pcm_to_wav(pcm: bytes, sample_rate: int = 24000) -> bytes:
    """Wrap raw 16-bit mono PCM in a WAV header (ElevenLabs returns PCM)."""
    byte_rate = sample_rate * 2  # 1 channel * 16-bit
    block_align = 2
    header = (
        b"RIFF"
        + struct.pack("<I", 36 + len(pcm))
        + b"WAVEfmt "
        + struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, byte_rate, block_align, 16)
        + b"data"
        + struct.pack("<I", len(pcm))
    )
    return header + pcm


def _synthesize_speech_elevenlabs(
    base_url: str,
    api_key: str,
    voice_id: str,
    text: str,
    model: str = "",
) -> bytes:
    """Generate speech via ElevenLabs. voice_id is a hex voice id (not a name).

    ElevenLabs uses POST /text-to-speech/{voice_id} + an xi-api-key header, and
    returns PCM (pcm_24000) which we wrap as WAV so the eval pipeline can load it.
    """
    model_id = model or "eleven_multilingual_v2"
    headers = {
        "xi-api-key": (api_key or "").strip(),
        "Content-Type": "application/json",
    }
    with _client(base_url.rstrip("/"), headers) as client:
        resp = client.post(
            f"/text-to-speech/{voice_id}",
            json={"text": text, "model_id": model_id},
            params={"output_format": "pcm_24000"},
        )
        resp.raise_for_status()
        return _pcm_to_wav(resp.content)


def _synthesize_speech_google(
    base_url: str,
    api_key: str,
    text: str,
    voice: str = "en-US",
    voice_gender: str = "female",
) -> bytes:
    """Generate speech via Google Cloud Text-to-Speech (API key auth).

    `voice` is a BCP-47 language code (e.g. "ja-JP"); `voice_gender` selects the
    default voice for that language. Returns LINEAR16 PCM wrapped as WAV.
    """
    language_code = voice or "en-US"
    gender = "MALE" if (voice_gender or "").lower() == "male" else "FEMALE"
    body = {
        "input": {"text": text},
        "voice": {"languageCode": language_code, "ssmlGender": gender},
        "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": 24000},
    }
    path = "/text:synthesize"
    if api_key:
        path += f"?key={api_key}"
    with _client(base_url.rstrip("/"), {"Content-Type": "application/json"}) as client:
        resp = client.post(path, json=body)
        resp.raise_for_status()
        return _pcm_to_wav(base64.b64decode(resp.json()["audioContent"]))


def synthesize_speech(
    base_url: str,
    api_key: str,
    auth_type: str = "bearer",
    model: str = "",
    text: str = "",
    voice: str = "alloy",
    api_format: str = "openai",
    **kwargs,
) -> bytes:
    """Generate speech from text. Dispatches on api_format:
    - "elevenlabs": native ElevenLabs TTS (voice is a voice id).
    - otherwise: OpenAI-compatible /audio/speech (voice is a name).

    Raises ModelAPIError on transport/auth/API failures.
    """
    try:
        if api_format == "elevenlabs":
            return _synthesize_speech_elevenlabs(
                base_url=base_url, api_key=api_key,
                voice_id=voice or "", text=text, model=model,
            )
        if api_format == "google_tts":
            return _synthesize_speech_google(
                base_url=base_url, api_key=api_key, text=text,
                voice=voice or "", voice_gender=kwargs.get("voice_gender", "female"),
            )
        return _synthesize_speech_openai(
            base_url=base_url, api_key=api_key, auth_type=auth_type,
            model=model, text=text, voice=voice,
        )
    except ModelAPIError:
        raise
    except httpx.HTTPStatusError as e:
        raise ModelAPIError.from_httpx(e) from e
    except httpx.RequestError as e:
        raise ModelAPIError.from_connection(e, url=base_url) from e
    except Exception as e:
        raise ModelAPIError(
            ModelAPIError.KIND_UNKNOWN, None, str(e), url=base_url,
        ) from e


# ── Dedicated OCR APIs (Mistral: POST {base}/ocr) ─────────────────────────────

def ocr_markdown(base_url: str, api_key: str, model: str, data_url: str, auth_type: str = "bearer",
                 *, timeout: float = 120) -> str:
    """Send one page image to a dedicated OCR endpoint; returns its markdown (pages joined by newlines).

    Request/response per https://docs.mistral.ai/api/endpoint/ocr (document.type "image_url", pages[].markdown).
    Raises ModelAPIError on transport/auth/API failures, like chat_completion.
    """
    url, headers = auth_headers(base_url, api_key, auth_type)
    body = {"model": model, "document": {"type": "image_url", "image_url": data_url}}
    try:
        with httpx.Client(base_url=url, headers=headers, timeout=timeout, trust_env=False) as client:
            resp = client.post("/ocr", json=body)
            resp.raise_for_status()
            return "\n".join(p.get("markdown", "") for p in resp.json().get("pages", []))
    except ModelAPIError:
        raise
    except httpx.HTTPStatusError as e:
        raise ModelAPIError.from_httpx(e) from e
    except httpx.RequestError as e:
        raise ModelAPIError.from_connection(e, url=base_url) from e
    except Exception as e:
        raise ModelAPIError(ModelAPIError.KIND_UNKNOWN, None, str(e), url=base_url) from e


def probe_ocr_api(base_url: str, api_key: str, model: str, auth_type: str = "bearer") -> str:
    """Settings test for a dedicated OCR endpoint: same three outcomes as probe_vision."""
    try:
        text = ocr_markdown(base_url=base_url, api_key=api_key, model=model,
                            data_url=_probe_png_data_url(), auth_type=auth_type, timeout=30)
    except ModelAPIError:
        return "unreachable"
    return "reads_images" if _VISION_WORD.lower() in "".join(text.lower().split()) else "no_vision"


# ── Vision probe (settings "Test connection" for OCR endpoints) ───────────────

_VISION_WORD = "FLUENCE"
_NO_VISION_HINTS = ("image", "vision", "multimodal", "multi-modal", "content type")


def _probe_png_data_url() -> str:
    import io
    from PIL import Image, ImageDraw, ImageFont

    im = Image.new("RGB", (360, 120), "white")
    try:
        font = ImageFont.load_default(size=56)
    except TypeError:  # Pillow < 10.1 has no sized default font
        font = ImageFont.load_default()
    ImageDraw.Draw(im).text((20, 28), _VISION_WORD, font=font, fill="black")
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def probe_vision(base_url: str, api_key: str, model: str, auth_type: str = "bearer", api_format: str = "openai") -> str:
    """Can this endpoint (OpenAI, Anthropic or Gemini format) read an image? -> "reads_images" | "no_vision" | "unreachable".

    Sends a generated PNG containing a fixed word and checks the model reads it back, so a text-only
    model that merely accepts the request is reported as "no_vision" instead of "connected".
    """
    messages = [{"role": "user", "content": [
        {"type": "text", "text": "Reply with only the word written in this image."},
        {"type": "image_url", "image_url": {"url": _probe_png_data_url()}},
    ]}]
    try:
        reply = chat_completion(
            base_url=base_url, api_key=api_key, model=model, messages=messages,
            max_tokens=20, temperature=0, api_format=api_format, auth_type=auth_type, timeout=30,
        )
    except ModelAPIError as e:
        if e.kind == ModelAPIError.KIND_CLIENT and any(h in e.message.lower() for h in _NO_VISION_HINTS):
            return "no_vision"
        return "unreachable"
    return "reads_images" if _VISION_WORD.lower() in "".join((reply or "").lower().split()) else "no_vision"
