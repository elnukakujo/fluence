from flask import abort, jsonify, make_response, request
from pydantic import BaseModel, ValidationError


def parse_json(schema: type[BaseModel]) -> BaseModel:
    """Validate the JSON body against `schema`; a missing/invalid body answers 400 with the field errors (never 500)."""
    try:
        return schema.model_validate(request.get_json(silent=True) or {})
    except ValidationError as e:
        errors = [{"loc": list(err["loc"]), "msg": err["msg"]} for err in e.errors()]
        abort(make_response(jsonify({"error": "Validation failed", "details": errors}), 400))
