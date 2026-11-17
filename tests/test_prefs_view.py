"""PrefsView: one read of the settings spec 3 needs; spec 4 adds the screens."""
from lapp.models.system_data import User
from lapp.services import ReviewService  # noqa: F401  (import order: services before schemas, circular otherwise)
from lapp.schemas.system_data.user_preferences import UserPreferencesDict
from lapp.services.system_data import UserPreferencesService
from lapp.services.system_data.prefs_view import prefs_for


def _user(db):
    with db.session_scope() as s:
        db.insert(User(id="user_U1", username="a", email="a@x.com"), session=s, commit=False)


def test_defaults_for_a_user_without_a_row(db):
    _user(db)
    p = prefs_for("user_U1")
    assert (p.timezone, p.streak_min_answers, p.reviews_per_day, p.enabled_skills) == (None, 20, 40, {})


def test_reads_the_stored_values(db):
    _user(db)
    UserPreferencesService().create(UserPreferencesDict(user_id="user_U1", reviews_per_day=35,
                                                        timezone="Pacific/Auckland", streak_min_answers=12))
    p = prefs_for("user_U1")
    assert (p.timezone, p.streak_min_answers, p.reviews_per_day) == ("Pacific/Auckland", 12, 35)


def test_to_dict_exposes_the_new_fields(db):
    _user(db)
    UserPreferencesService().create(UserPreferencesDict(user_id="user_U1"))
    d = UserPreferencesService().get_by_user_id("user_U1", as_dict=True)
    assert d["reviews_per_day"] == 40 and d["timezone"] is None and d["streak_min_answers"] == 20
