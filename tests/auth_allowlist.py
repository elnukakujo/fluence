"""Routes that are public on purpose: (rule, method). Everything else must answer 401 without a session."""

AUTH_OPEN: set[tuple[str, str]] = {
    ("/api/auth/login", "POST"),
    ("/api/auth/me", "GET"),
    ("/api/user/", "POST"),  # signup
    ("/api/user/<user_id>/password", "PUT"),  # first-login password, decision S6
    ("/api/auth/logout", "POST"),  # idempotent, clears the cookie
    ("/health", "GET"),
}

# Rules never walked: Flask's own static view, the Swagger UI and the routes tests register themselves.
SKIP_PREFIXES = ("/static", "/flasgger_static", "/apidocs", "/apispec", "/oauth2-redirect", "/test/")
