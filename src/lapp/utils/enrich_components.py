from .phonetics import get_phonetic
from .strokes import get_cjk_character_info
from .tokenize import get_content_words, get_characters
from .translate import translate
from .word_type import get_word_type
from .word_gender import get_gender
from .passage import is_passage

def enrich_character(character_text: str, target_iso1: str, source_iso1: str) -> dict:
    """
    Compute all storable fields for a Character DB entity.
 
    For CJK (zh/ja) this queries hanzipy for radical, stroke count, and an
    English gloss, then translates the gloss to the learner's language.
    For other scripts only phonetic (if applicable) and a direct translation
    are returned; radical and strokes are left empty/None.
 
    Args:
        character_text: Single character, e.g. "北" or "Ω".
        target_iso1:           Language ISO code,       e.g. "zh".
        source_iso1:    Learner's native language, e.g. "fr".
 
    Returns:
        {
          "phonetic": "běi",
          "radical":  "匕",         # "" for non-CJK
          "meaning":  "nord",       # translated into source_iso1
        }
    """
    cjk = get_cjk_character_info(character_text, target_iso1)
 
    if cjk["meaning"]:
        # Translate CEDICT English gloss → learner's language
        meaning = (
            translate(cjk["meaning"], "en", source_iso1)
            if source_iso1 != "en"
            else cjk["meaning"]
        )
    else:
        # Non-CJK or unknown: translate the character itself
        meaning = translate(character_text, target_iso1, source_iso1)
 
    return {
        "phonetic": get_phonetic(character_text, target_iso1),
        "radical":  cjk["radical"],
        "meaning":  meaning,
    }
 
 
def enrich_word(word_text: str, source_iso1: str, target_iso1: str, target_spacy_model: str) -> dict:
    """
    Compute all storable fields for a Word DB entity.

    Args:
        word_text:   The word, e.g. "北京" or "courir".
        source_iso1: Language of the translation, e.g. "en".
        target_iso1: Language of the word, e.g. "zh".
        target_spacy_model: The spaCy model to use for tokenization.

    Returns:
        {
          "phonetic":    "běi jīng",
          "translation": "Beijing",
          "word_type":   "noun",
          "word_gender":      "",
          "characters":  ["北", "京"],
        }
    """
    passage = is_passage(word_text)         # a whole sentence has no part of speech or gender of its own
    return {
        "phonetic":    get_phonetic(word_text, target_iso1),
        "translation": translate(word_text, target_iso1, source_iso1),
        "word_type":   "sentence" if passage else get_word_type(word_text, target_iso1),
        "word_gender": "" if passage else get_gender(word_text, target_iso1),
        "characters":  get_characters(word_text, target_spacy_model),
    }
 
 
def enrich_passage(passage_text: str, target_iso1: str, source_iso1: str, target_spacy_model: str) -> dict:
    """
    Compute all storable fields for a Passage DB entity and return the token
    lists needed to populate passage_word and passage_character junction tables.
 
    Args:
        passage_text: Full passage text.
        target_iso1:         Language of the passage.
        source_iso1:  Learner's native language.
        target_spacy_model: The spaCy model to use for tokenization.
 
    Returns:
        {
          "translation": str,
          "words":       list[str],  # lemmas — match against Word table
          "characters":  list[str],  # individual chars — match against Character table
        }
    """
    return {
        "translation": translate(passage_text, target_iso1, source_iso1),
        "words":       get_content_words(passage_text, target_spacy_model),
        "characters":  get_characters(passage_text, target_spacy_model),
    }