"""Exercise content validation: does a stored `content` fit its exercise type?

Moved out of `services/ingestion/elements.py` so `models/features/exercise.py` (which calls these
from its `needs` property) no longer imports the ingestion service.
"""
import json

from .registry import EXERCISE_TYPES

_TYPE_CONTENT = {
    "quizz": 'exactly {"options": [str, ...], "correct": [indexes of every right option, e.g. [1]]}',
    "true_false": 'exactly {"statement": str, "answer": true|false}',
    "organize": 'exactly {"items": [str, ...], "answer_order": a permutation of 0..n-1}',
    "type_in_the_blank": 'exactly {"segments": [str, ...], "blanks": [{"answer": str}, ...]} with one more segment than blanks (the text around each gap)',
    "select_in_the_blank": 'exactly {"segments": [str, ...], "blanks": [{"answer": str, "options": [str, ...]}, ...]} with one more segment than blanks '
                           "and at least 2 options per blank that include the answer",
    "matching": 'exactly {"pairs": [[str, str], ...]}',
    "conversation": 'exactly {"speakers": [{"name": str, "is_learner": true|false}, ...], "lines": [{"speaker": a speaker name, "text": str}, ...]} '
                    "(one learner speaker, at least one other, lines in page order; `question` is the instruction line and `answer` may be empty)",
    "reading": 'exactly {"speakers": [{"name": str}, ...], "lines": [{"speaker": a speaker name, "text": str, "translation": str|null}, ...]} '
               "(a text or dialogue to read and study, speaker names as printed, one speaker for a plain passage, lines in page order; "
               "`translation` only when the page prints one next to the line; `question` is the instruction or title)",
    "dictation": 'exactly {"lines": [{"text": str}, ...]} (the sentences to be dictated, one per line, in page order; `question` is the instruction)',
}


def exercise_content_error(exercise_type: str, content) -> str | None:
    """None if `content` fits `exercise_type`, else a reason the model can act on."""
    if exercise_content_ok(exercise_type, content):
        return None
    return f"content for {exercise_type} must be {_TYPE_CONTENT.get(exercise_type, 'null')}; got {json.dumps(content, ensure_ascii=False)}"


def exercise_content_ok(exercise_type: str, content) -> bool:
    """Check if content shape matches the exercise_type requirements."""
    if exercise_type not in EXERCISE_TYPES:
        return False

    # Structured types require the shape the app's own exercise form/runners use (client ExerciseContent)
    if exercise_type == "quizz":
        correct = content.get("correct") if isinstance(content, dict) else None
        options = content.get("options") if isinstance(content, dict) else None
        return (isinstance(options, list) and len(options) >= 2 and all(isinstance(o, str) for o in options)
                and isinstance(correct, list) and len(correct) >= 1 and len(set(correct)) == len(correct)
                and all(isinstance(i, int) and not isinstance(i, bool) and 0 <= i < len(options) for i in correct))
    elif exercise_type == "true_false":
        return (isinstance(content, dict) and not isinstance(content, bool) and "statement" in content and "answer" in content and
                isinstance(content.get("statement"), str) and len(content.get("statement", "")) > 0 and
                isinstance(content.get("answer"), bool))
    elif exercise_type == "organize":
        return (isinstance(content, dict) and not isinstance(content, bool) and "items" in content and "answer_order" in content and
                isinstance(content.get("items"), list) and isinstance(content.get("answer_order"), list) and
                len(content["answer_order"]) == len(content["items"]) and
                set(content["answer_order"]) == set(range(len(content["items"]))))
    elif exercise_type in ("type_in_the_blank", "select_in_the_blank"):
        if not (isinstance(content, dict) and isinstance(content.get("segments"), list) and isinstance(content.get("blanks"), list)):
            return False
        segments, blanks = content["segments"], content["blanks"]
        if len(segments) != len(blanks) + 1 or not all(isinstance(x, str) for x in segments):
            return False
        for blank in blanks:
            if not (isinstance(blank, dict) and isinstance(blank.get("answer"), str) and blank["answer"].strip()):
                return False
            options = blank.get("options")
            if options is not None and not (isinstance(options, list) and all(isinstance(o, str) for o in options)):
                return False
            if exercise_type == "select_in_the_blank" and not (options and len(options) >= 2 and blank["answer"] in options):
                return False
        return True
    elif exercise_type == "conversation":
        if not (isinstance(content, dict) and isinstance(content.get("speakers"), list) and isinstance(content.get("lines"), list)):
            return False
        speakers, lines = content["speakers"], content["lines"]
        names = [sp["name"].strip() if isinstance(sp, dict) and isinstance(sp.get("name"), str) else "" for sp in speakers]
        if not (2 <= len(names) <= 5) or "" in names or len(set(names)) != len(names):
            return False
        learners = [sp.get("is_learner") for sp in speakers]
        if not all(isinstance(x, bool) for x in learners) or not (1 <= sum(learners) < len(names)):
            return False
        return len(lines) >= 2 and all(isinstance(l, dict) and l.get("speaker") in names and isinstance(l.get("text"), str) and l["text"].strip()
                                       for l in lines)
    elif exercise_type == "reading":
        if not (isinstance(content, dict) and isinstance(content.get("speakers"), list) and isinstance(content.get("lines"), list)):
            return False
        names = [sp["name"].strip() if isinstance(sp, dict) and isinstance(sp.get("name"), str) else "" for sp in content["speakers"]]
        if not names or "" in names or len(set(names)) != len(names) or not content["lines"]:
            return False
        return all(isinstance(l, dict) and l.get("speaker") in names and isinstance(l.get("text"), str) and l["text"].strip()
                   and (l.get("translation") is None or isinstance(l["translation"], str)) for l in content["lines"])
    elif exercise_type == "dictation":
        lines = content.get("lines") if isinstance(content, dict) else None
        return isinstance(lines, list) and len(lines) >= 1 and all(isinstance(l, dict) and isinstance(l.get("text"), str) and l["text"].strip() for l in lines)
    elif exercise_type == "matching":
        return (isinstance(content, dict) and not isinstance(content, bool) and "pairs" in content and
                isinstance(content.get("pairs"), list) and len(content["pairs"]) >= 1 and
                all(isinstance(p, list) and len(p) == 2 and isinstance(p[0], str) and isinstance(p[1], str)
                    for p in content["pairs"]))
    else:
        # Non-structured types: content must be None or empty dict
        return content is None or (isinstance(content, dict) and not isinstance(content, bool) and len(content) == 0)


def conversation_json_ok(question: str, answer: str) -> bool:
    """`question` / `answer` of a stored conversation, as the app's runner parses them (speakers + lines JSON)."""
    try:
        q, a = json.loads(question), json.loads(answer)
    except (TypeError, ValueError):
        return False
    for data in (q, a):
        if not (isinstance(data, dict) and isinstance(data.get("speakers"), list) and isinstance(data.get("lines"), list)):
            return False
        ids = [sp.get("id") for sp in data["speakers"] if isinstance(sp, dict)]
        if len(ids) != len(data["speakers"]) or not all(isinstance(i, str) and i for i in ids) or len(set(ids)) != len(ids):
            return False
        if not all(isinstance(sp.get("name"), str) and isinstance(sp.get("isUser"), bool) for sp in data["speakers"]):
            return False
        if not all(isinstance(l, dict) and l.get("speakerId") in ids and isinstance(l.get("text"), str)
                   and (l.get("audioIndex") is None or isinstance(l["audioIndex"], int)) for l in data["lines"]):
            return False
    users = [sp for sp in q["speakers"] if sp["isUser"]]
    return bool(users) and len(users) < len(q["speakers"]) and len(q["lines"]) >= 2


def reading_content(content: dict) -> dict:
    """The stored `reading` content (spec shape) from the model's shape: generated speaker ids, no clips yet."""
    speakers = [{"id": f"s{i + 1}", "name": sp["name"].strip()} for i, sp in enumerate(content["speakers"])]
    ids = {sp["name"]: sp["id"] for sp in speakers}
    tr = lambda v: v.strip() if isinstance(v, str) and v.strip() else None
    return {"speakers": speakers, "lines": [{"speakerId": ids[l["speaker"].strip()], "text": l["text"].strip(),
                                             "translation": tr(l.get("translation")), "audioIndex": None} for l in content["lines"]]}


def reading_stored_ok(content) -> bool:
    """Is a STORED reading (speakers with ids, lines by `speakerId`, see reading_content) usable by the runner?"""
    if not (isinstance(content, dict) and isinstance(content.get("speakers"), list) and isinstance(content.get("lines"), list) and content["lines"]):
        return False
    ids = {sp.get("id") for sp in content["speakers"] if isinstance(sp, dict) and isinstance(sp.get("name"), str) and sp["name"].strip()}
    return bool(ids) and all(isinstance(l, dict) and l.get("speakerId") in ids and isinstance(l.get("text"), str) and l["text"].strip() for l in content["lines"])
