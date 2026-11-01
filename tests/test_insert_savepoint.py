from lapp.core.database import db_manager
from lapp.models.system_data import User


def test_failed_insert_keeps_earlier_writes_of_the_same_transaction(db):
    """A failing insert with commit=False must not roll back what the caller already wrote (a lesson import
    adds 200+ items in one transaction; one duplicate used to wipe the lesson itself)."""
    with db_manager.session_scope() as session:
        assert db_manager.insert(User(id="u_keep", username="keep"), session, commit=False) is not None
        db_manager.insert(User(id="u_other", username="keep"), session, commit=False)   # unique username clash
    assert db_manager.find_by_attr(model_class=User, attr_values={"id": "u_keep"}) is not None
