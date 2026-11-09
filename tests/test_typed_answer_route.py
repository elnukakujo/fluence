from lapp.models.system_data import User
from lapp.services.auth import AuthService


def _client(app, db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)
    client = app.test_client()
    client.set_cookie('session_token', AuthService().create_session("user_U1", remember=False))
    return client


def test_returns_closeness_and_diff(app, db):
    res = _client(app, db).post('/api/evaluate/typed-answer', json={'text': 'bonjoux', 'expected': 'bonjour', 'iso1': 'fr'})
    body = res.get_json()
    assert res.status_code == 200 and abs(body['closeness'] - 6 / 7) < 1e-6 and body['diff'] == [6]


def test_requires_login(app, db):
    assert app.test_client().post('/api/evaluate/typed-answer', json={'expected': 'a'}).status_code == 401


def test_400_without_expected(app, db):
    assert _client(app, db).post('/api/evaluate/typed-answer', json={'text': 'a'}).status_code == 400


def test_language_id_gives_phonetic_leniency(app, db):
    from lapp.models.containers import Language
    client = _client(app, db)
    with db.session_scope() as s:
        db.insert(Language(id="lang_L1", user_id="user_U1", name="Chinese", target_iso639_2t="zho"), session=s, commit=False)
    body = client.post('/api/evaluate/typed-answer', json={'text': '事', 'expected': '是', 'language_id': 'lang_L1'}).get_json()
    assert abs(body['closeness'] - 0.7) < 1e-6          # same pinyin: PHONETIC_SUB_COST, not a full miss
