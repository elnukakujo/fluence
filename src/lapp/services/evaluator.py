import numpy as np
from scipy.spatial.distance import cosine
import language_tool_python
from sqlalchemy.orm import Session
from typing import Optional
import torch
import torchaudio
import soundfile as sf
import math
import traceback

import logging
logger = logging.getLogger(__name__)

from ..core.database import db_manager, transactional
from ..utils import (
    detect_text_language,
    get_language_by_iso2t,
    load_spacy_model,
    get_text_embedding_model,
    get_audio_embedding_model,
    get_audio_embedding_processor,
    get_stt_pipe,
)
from .features import ExerciseService
from .feedback import FeedbackService

exercise_service = ExerciseService()
feedback_service = FeedbackService()

class EvaluatorService:
    @property
    def text_embedding_model(self):
        return get_text_embedding_model()

    @property
    def audio_embedding_model(self):
        return get_audio_embedding_model()

    @property
    def audio_embedding_processor(self):
        return get_audio_embedding_processor()

    @property
    def stt_pipe(self):
        return get_stt_pipe()

    exercises_scales = {
        "translate": (0.6, 0.2, 0.2),
        "organize": (0.5, 0.1, 0.4),
        "type_in_the_blank": (0.5, 0.1, 0.4),
        "essay": (0.4, 0.4, 0.2),
        "answering": (0.6, 0.3, 0.1),
        "speaking": (0.3, 0.1, 0.6),
        "conversation": (0.3, 0.1, 0.6)
    }

    exercises_thresholds = {
        "speaking":0.70,
        "type_in_the_blank":0.70,
        "organize":0.65,
        "translate":0.80,
        "answering":0.55,
        "conversation":0.50,
        "essay":0.45
    }

    grammar_fallback_score = 1.0

    def _get_language_codes_from_exercise(self, exercise) -> tuple[Optional[str], Optional[str]]:
        """Best-effort read of source/target ISO 639-2/T from exercise language container."""
        try:
            language = exercise.lesson.language if exercise and exercise.lesson else None
            if not language:
                return None, None

            source_iso2t = (language.source_iso639_2t or "").strip().lower() or None
            target_iso2t = (language.target_iso639_2t or "").strip().lower() or None
            return source_iso2t, target_iso2t
        except Exception as err:
            logger.warning(f"Could not resolve language codes from exercise context: {err}")
            return None, None

    def _get_correct_text_and_type(self, ex_id: str, session: Optional[Session] = None) -> tuple[Optional[str], Optional[str]]:
        exercise = exercise_service.get_by_id(ex_id, session=session)

        if not exercise:
            logger.warning(f"Exercise item not found: {ex_id}")
            return False, None

        if not exercise.exercise_type in ['translate', 'essay', 'organize', 'answering', 'type_in_the_blank']:
            logger.warning(f"Exercise item {ex_id} is not a translation exercise")
            return False, None

        return exercise.answer, exercise.exercise_type

    def _get_correct_audio_path_and_type(self, ex_id: str, correct_audio_index: int, session: Optional[Session] = None) -> tuple[Optional[str], Optional[str]]:
        exercise = exercise_service.get_by_id(ex_id, session=session)

        if not exercise:
            logger.warning(f"Exercise item not found: {ex_id}")
            return False, None

        if not exercise.exercise_type in ['speaking', 'conversation']:
            logger.warning(f"Exercise item {ex_id} is not a speaking exercise")
            return False, None

        if not exercise.audio_files:
            logger.warning(f"Exercise item {ex_id} has no audio files")
            return False, None

        from .media import MediaService
        media_service = MediaService()

        _, correct_speaking_path = media_service.get_file_path("/".join(exercise.audio_files[correct_audio_index].split("/")[2:]))

        return correct_speaking_path, exercise.exercise_type

    def _extract_waveform_from_path(self, audio_path: str) -> np.ndarray:
        # torchaudio.load defaults to the torchcodec backend (FFmpeg+CUDA) which
        # isn't installed; our audio is always WAV, so read it with soundfile.
        data, sr = sf.read(audio_path, dtype="float32")
        if data.ndim > 1:
            data = data.mean(axis=1)
        waveform = torch.from_numpy(data)
        if sr != 16000:
            waveform = torchaudio.transforms.Resample(orig_freq=sr, new_freq=16000)(waveform)
        return waveform.numpy()
    
    def _speech_to_embeddings(self, waveform: np.ndarray) -> list[float]:
        device = next(self.audio_embedding_model.parameters()).device
        input_processed = self.audio_embedding_processor(waveform, sampling_rate=16000, return_tensors="pt", padding=True).to(device)
        return self.audio_embedding_model(**input_processed, output_hidden_states=True).hidden_states[-1].squeeze(0).mean(dim=0).detach().cpu().numpy()
    
    def _speech_to_text(self, waveform: np.ndarray) -> str:
        return self.stt_pipe(waveform, return_timestamps=False)["text"]

    def _compute_cosine_similarity(self, vec1: list[float], vec2: list[float]) -> float:
        return float(1-cosine(u = vec1, v = vec2))

    def _compute_grammar_error_rate(
        self,
        user_translation: str,
        correct_translation: str,
        target_lang_iso2t: Optional[str] = None,
    ) -> float:
        language = get_language_by_iso2t(target_lang_iso2t) if target_lang_iso2t else detect_text_language(correct_translation)
        if language.iso1 == "unknown":
            language = detect_text_language(correct_translation)

        try:
            tool = language_tool_python.LanguageTool(language.iso1)
            matches = tool.check(user_translation)
        except Exception as err:
            logger.warning(
                f"LanguageTool check failed for language '{language.iso1}'. "
                f"Using fallback grammar score {self.grammar_fallback_score:.2f}. Error: {err}"
            )
            return self.grammar_fallback_score

        WHITESPACE_RULE_IDS = {
            "WHITESPACE_BEFORE_PUNCTUATION",
            "WHITESPACE_AFTER_PUNCTUATION", 
            "DOUBLE_WHITESPACE",
            "WHITESPACE_RULE",
            "TYPOGRAPHY_RULE",
        }

        substantive_errors = [
            m for m in matches
            if m.rule_id not in WHITESPACE_RULE_IDS
            and not "WHITESPACE" in m.rule_id
            and m.category != "MISC"
        ]

        num_errors = len(substantive_errors)
        score = math.exp(-0.4 * num_errors)
        logger.info(
            f"Grammar check for '{user_translation}': "
            f"{len(matches)} raw → {num_errors} substantive errors → score {score:.3f} "
            f"(filtered: {[m.rule_id for m in matches if m not in substantive_errors]})"
        )
        logger.info(substantive_errors)
        return score
    
    def _compute_token_differences_rate(
        self,
        user_translation: str,
        correct_translation: str,
        target_lang_iso2t: Optional[str] = None,
    ) -> float:
        language = get_language_by_iso2t(target_lang_iso2t) if target_lang_iso2t else detect_text_language(correct_translation)
        if language.spacy_model == "unknown":
            language = detect_text_language(correct_translation)

        nlp = load_spacy_model(language.spacy_model)

        # Normalize whitespace for CJK languages where spaces are not meaningful
        normalized_user = user_translation.replace(" ", "") if language.iso1 in ("zh", "ja", "ko") else user_translation
        normalized_correct = correct_translation.replace(" ", "") if language.iso1 in ("zh", "ja", "ko") else correct_translation

        user_doc = nlp(normalized_user)
        correct_doc = nlp(normalized_correct)

        user_tokens = set(t.text.lower() for t in user_doc if not t.is_punct and not t.is_space)
        correct_tokens = set(t.text.lower() for t in correct_doc if not t.is_punct and not t.is_space)

        if not user_tokens:
            return 1.0 if not correct_tokens else 0.5

        common_tokens = correct_tokens.intersection(user_tokens)
        return min(1, len(common_tokens) / len(user_tokens))
    
    def _evaluate_text(
        self,
        ex_id: str,
        user_text: str,
        target_lang_iso2t: Optional[str] = None,
        session: Optional[Session] = None,
    ) -> dict[str, float | str]:
        correct_text, exercise_type = self._get_correct_text_and_type(ex_id, session=session)
        if not correct_text:
            logger.warning(f"Could not retrieve correct text for Exercise {ex_id}. Returning score of 0.")
            raise ValueError("Correct text not found for the given exercise ID.")

        # Get the weights for the specific exercise type
        x, y, z = self.exercises_scales[exercise_type]

        embedding_similarity = self._compute_cosine_similarity(
            self.text_embedding_model.encode(user_text),
            self.text_embedding_model.encode(correct_text)
        )
        logger.info(f"Embedding similarity for Exercise {ex_id}between user: '{user_text}' and correct answer: '{correct_text}' is {embedding_similarity:.4f}")
        
        grammar_error_rate = self._compute_grammar_error_rate(
            user_translation=user_text,
            correct_translation=correct_text,
            target_lang_iso2t=target_lang_iso2t,
        )
        logger.info(f"Grammar error rate for Exercise {ex_id} for user text: '{user_text}' is {grammar_error_rate:.4f}") 

        token_difference_rate = self._compute_token_differences_rate(
            user_translation=user_text,
            correct_translation=correct_text,
            target_lang_iso2t=target_lang_iso2t,
        )
        logger.info(f"Token difference rate for Exercise {ex_id} between user: '{user_text}' and correct answer: '{correct_text}' is {token_difference_rate:.4f}")

        return {
            "score": x * embedding_similarity + y * grammar_error_rate + z * token_difference_rate,
            "similarity": embedding_similarity,
            "grammar_error_rate": grammar_error_rate,
            "token_difference_rate": token_difference_rate,
            "user_answer": user_text,
            "correct_answer": correct_text,
        }
    
    def _evaluate_speech(
        self,
        ex_id: str,
        user_audio_path: str,
        correct_audio_index: int,
        target_lang_iso2t: Optional[str] = None,
        session: Optional[Session] = None,
    ) -> dict[str, float | str]:
        correct_audio_path, exercise_type = self._get_correct_audio_path_and_type(ex_id, correct_audio_index, session=session)
        if not correct_audio_path:
            logger.warning(f"Could not retrieve correct audio path for Exercise {ex_id}. Returning score of 0.")
            raise ValueError("Correct audio path not found for the given exercise ID.")
        
        from .media import MediaService
        media_service = MediaService()
        _, user_audio_path = media_service.get_file_path(user_audio_path)

        logger.info(f"Evaluating speech for Exercise {ex_id} with user audio: '{user_audio_path}' and correct audio: '{correct_audio_path}'")

        correct_waveform = self._extract_waveform_from_path(correct_audio_path)
        user_waveform = self._extract_waveform_from_path(user_audio_path)
        
        embedding_similarity = self._compute_cosine_similarity(
            self._speech_to_embeddings(user_waveform),
            self._speech_to_embeddings(correct_waveform)
        )

        user_transcription = self._speech_to_text(user_waveform)
        correct_transcription = self._speech_to_text(correct_waveform)
        logger.info(f"Transcribed user audio for Exercise {ex_id}: '{user_transcription}'")
        logger.info(f"Transcribed correct audio for Exercise {ex_id}: '{correct_transcription}'")

        grammar_error_rate = self._compute_grammar_error_rate(
            user_transcription,
            correct_transcription,
            target_lang_iso2t=target_lang_iso2t,
        )

        token_difference_rate = self._compute_token_differences_rate(
            user_transcription,
            correct_transcription,
            target_lang_iso2t=target_lang_iso2t,
        )

        # Get the weights for the specific exercise type
        x, y, z = self.exercises_scales[exercise_type]

        return {
            "score": x * embedding_similarity + y * grammar_error_rate + z * token_difference_rate,
            "similarity": embedding_similarity,
            "grammar_error_rate": grammar_error_rate,
            "token_difference_rate": token_difference_rate,
            "user_transcription": user_transcription,
            "correct_transcription": correct_transcription,
        }

    def evaluate(self, ex_id: str, user_input: str, input_type: str, correct_audio_index: int = 0):
        try:
            with db_manager.session_scope() as session:
                exercise = exercise_service.get_by_id(ex_id, session=session)
                if not exercise:
                    logger.warning("Exercise %s not found, returning safe fallback", ex_id)
                    return {"correct": False, "score": 0.0, "feedback": "Exercise not found."}

                source_lang_code, target_lang_code = self._get_language_codes_from_exercise(exercise)

                if input_type == 'text':
                    results = self._evaluate_text(
                        ex_id=ex_id,
                        user_text=user_input,
                        target_lang_iso2t=target_lang_code,
                        session=session,
                    )
                elif input_type == 'speech':
                    results = self._evaluate_speech(
                        ex_id=ex_id,
                        user_audio_path=user_input,
                        correct_audio_index=correct_audio_index,
                        target_lang_iso2t=target_lang_code,
                        session=session,
                    )
                else:
                    logger.warning("Invalid input type '%s', returning safe fallback", input_type)
                    return {"correct": False, "score": 0.0, "feedback": "Invalid exercise type."}

                logger.info("Evaluation results for Exercise %s with input type '%s': %s", ex_id, input_type, results)

                threshold = self.exercises_thresholds.get(exercise.exercise_type, 0.5)
                feedback = feedback_service.generate_feedback(
                    ex_id=ex_id,
                    user_input=user_input,
                    input_type=input_type,
                    target_lang_code=target_lang_code or "",
                    source_lang_code=source_lang_code or "",
                    results=results,
                    threshold=threshold,
                    correct_audio_index=correct_audio_index,
                    session=session,
                    exercise=exercise,
                )

                return {
                    "correct": results["score"] > threshold,
                    "score": results["score"],
                    "feedback": feedback,
                }
        except Exception:
            logger.error("evaluate failed for ex_id=%s:\n%s", ex_id, traceback.format_exc())
            return {"correct": False, "score": 0.0, "feedback": "Evaluation unavailable. Please try again."}