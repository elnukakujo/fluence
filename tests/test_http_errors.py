"""Routes /test/boom, /test/abort/<code>, /test/parse live in conftest (Flask refuses new routes after a request).
HTTP errors keep their status; unexpected errors answer a generic message; parse_json gives 400."""
def test_http_errors_keep_status(app):
    c = app.test_client()
    for code in (401, 405, 413, 415):
        assert c.get(f"/test/abort/{code}").status_code == code
    assert c.post("/test/boom").status_code == 405


def test_unexpected_error_is_generic(app):
    res = app.test_client().get("/test/boom")
    assert res.status_code == 500 and "SELECT" not in res.get_data(as_text=True)


def test_parse_json_missing_key_is_400(app):
    c = app.test_client()
    assert c.post("/test/parse", json={}).status_code == 400
    assert c.post("/test/parse", data="not json").status_code == 400
    assert c.post("/test/parse", json={"name": "a"}).get_json() == {"name": "a"}
