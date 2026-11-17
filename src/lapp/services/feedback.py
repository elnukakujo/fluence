import json
import logging
import re

logger = logging.getLogger(__name__)
from typing import Optional

from sqlalchemy.orm import Session

from ..core.database import db_manager, transactional
from ..utils import chat_completion
from ..utils.detect_language import get_language_by_iso2t
from ..services.capabilities import gated_api
from .features import ExerciseService
from .system_data import UserPreferencesService
user_preferences_service = UserPreferencesService()

exercise_service = ExerciseService()
user_preferences_service = UserPreferencesService()


class FeedbackService:
	feedback_instruct = (
		"You are a supportive language-learning tutor.\n"
		"Follow these rules exactly:\n"
		"1) Write feedback in SOURCE_LANG_CODE, never in TARGET_LANG_CODE - even though the "
		"QUESTION/USER_INPUT/REFERENCE_ANSWER you are evaluating are written in TARGET_LANG_CODE, "
		"your OUTPUT text itself must be in SOURCE_LANG_CODE.\n"
		"2) The learner practices TARGET_LANG_CODE. Evaluate performance for that target language.\n"
		"3) Output only 1 or 2 short sentences.\n"
		"4) Mention one strength and one concrete improvement point.\n"
		"5) Do not provide the correct answer.\n"
		"6) Do not mention internal model details.\n"
		"7) You may reference metrics only if useful for the learner."
	)

	feedback_shots = [
		[
			"SOURCE_LANG_CODE: eng\nTARGET_LANG_CODE: fra\nEXERCISE_TYPE: translate\nINPUT_TYPE: text\nSCORE: 0.92\nTHRESHOLD: 0.75\nCORRECT: true\nQUESTION: I went to the market.\nUSER_INPUT: Je suis allé au marché.\nREFERENCE_ANSWER: Je suis allé au marché.\nMETRICS_JSON: {\"similarity\": 0.95, \"grammar_error_rate\": 1.0, \"token_difference_rate\": 1.0}\nOUTPUT:",
			"Great work: your French answer is accurate and natural. To improve further, keep the same fluency when you use other tenses.",
		],
		[
			"SOURCE_LANG_CODE: eng\nTARGET_LANG_CODE: zho\nEXERCISE_TYPE: speaking\nINPUT_TYPE: speech\nSCORE: 0.58\nTHRESHOLD: 0.75\nCORRECT: false\nQUESTION: 吗\nUSER_INPUT: 马\nREFERENCE_ANSWER: 吗\nMETRICS_JSON: {\"similarity\": 0.61, \"grammar_error_rate\": 0.82, \"token_difference_rate\": 0.55}\nOUTPUT:",
			"You are close, but your Mandarin pronunciation changed the meaning. Practice this sound slowly with the reference audio and focus on tone contrast.",
		],
		[
			"SOURCE_LANG_CODE: spa\nTARGET_LANG_CODE: eng\nEXERCISE_TYPE: answering\nINPUT_TYPE: text\nSCORE: 0.41\nTHRESHOLD: 0.75\nCORRECT: false\nQUESTION: What did you do yesterday?\nUSER_INPUT: I go yesterday store.\nREFERENCE_ANSWER: I went to the store yesterday.\nMETRICS_JSON: {\"similarity\": 0.48, \"grammar_error_rate\": 0.57, \"token_difference_rate\": 0.50}\nOUTPUT:",
			"Vas bien con la idea principal, pero tu respuesta en ingles necesita mejor estructura. Revisa el tiempo verbal pasado y el orden de palabras para que suene natural.",
		],
	]

	def _format_context(self, context: dict[str, object]) -> str:
		source_lang_code = str(context.get('source_lang_code', '') or '')
		source_lang_name = get_language_by_iso2t(source_lang_code).name
		return (
			f"SOURCE_LANG_CODE: {source_lang_code}\n"
			f"TARGET_LANG_CODE: {context.get('target_lang_code', '')}\n"
			f"EXERCISE_TYPE: {context.get('exercise_type', '')}\n"
			f"INPUT_TYPE: {context.get('input_type', '')}\n"
			f"SCORE: {context.get('score', 0.0)}\n"
			f"THRESHOLD: {context.get('threshold', 0.0)}\n"
			f"CORRECT: {str(bool(context.get('correct', False))).lower()}\n"
			f"QUESTION: {context.get('question', '')}\n"
			f"USER_INPUT: {context.get('user_input', '')}\n"
			f"REFERENCE_ANSWER: {context.get('reference_answer', '')}\n"
			f"METRICS_JSON: {json.dumps(context.get('metrics', {}), ensure_ascii=False)}\n"
			# ponytail: repeated right before OUTPUT (not just in the system prompt) because
			# reasoning models were writing feedback in the target language instead - the
			# Chinese question/answer text in the context above biases them toward it otherwise.
			f"REMINDER: write your OUTPUT in {source_lang_name} ({source_lang_code}), regardless of what language the QUESTION/ANSWER above are in.\n"
			"OUTPUT:"
		)

	def _build_prompt(self, context: dict[str, object]) -> list[dict[str, str]]:
		messages = [{"role": "system", "content": self.feedback_instruct}]

		for user_shot, assistant_shot in self.feedback_shots:
			messages.append({"role": "user", "content": user_shot})
			messages.append({"role": "assistant", "content": assistant_shot})

		messages.append({"role": "user", "content": self._format_context(context)})
		return messages

	def _generate_with_model(self, context: dict[str, object], api: dict | None) -> str:
		if not api or not api.get("base_url"):
			logger.warning("No text-gen API configured for this user. Returning fallback feedback.")
			return self._fallback_feedback(context)

		try:
			messages = self._build_prompt(context)
			# ponytail: 512 not 96 - reasoning models spend most of the budget on the <think>
			# block before the actual answer, so a short cap truncates before any output.
			feedback = chat_completion(**api, messages=messages, max_tokens=512, temperature=0.5, timeout=30, disable_thinking=True).strip()
			# ponytail: defensive strip in case a reasoning model ignores the no-think instruction
			feedback = re.sub(r"<think>.*?</think>", "", feedback, flags=re.DOTALL).strip()
			return feedback or self._fallback_feedback(context)
		except Exception as err:
			logger.error(f"Failed to generate feedback with text model: {err}")
			return self._fallback_feedback(context)

	def _fallback_feedback(self, context: dict[str, object]) -> str:
		score = float(context.get("score", 0.0) or 0.0)
		correct = bool(context.get("correct", False))
		exercise_type = str(context.get("exercise_type", "exercise"))
		source_lang_code = str(context.get("source_lang_code", "eng") or "eng").lower()

		templates = {
			"eng": {
				"correct": f"Good work on this {exercise_type} exercise. Your answer is correct, so the next step is to keep refining clarity and naturalness.",
				"close": f"You are close on this {exercise_type} exercise. Review the small differences between your answer and the reference, especially wording and sentence flow.",
				"mid": f"You have the main idea for this {exercise_type} exercise, but part of the answer still needs work. Focus on the structure and compare your response with the reference.",
				"low": f"This {exercise_type} exercise needs more review. Try the reference again and focus on the key words, grammar pattern, or pronunciation that changed the meaning.",
			},
			"fra": {
				"correct": f"Bon travail pour cet exercice de {exercise_type}. Votre reponse est correcte, et la prochaine etape est d'ameliorer encore la clarte et la fluidite.",
				"close": f"Vous etes proche pour cet exercice de {exercise_type}. Revoyez les petites differences avec la reponse de reference, surtout le choix des mots et la fluidite.",
				"mid": f"L'idee principale est presente dans cet exercice de {exercise_type}, mais une partie de la reponse doit etre corrigee. Concentrez-vous sur la structure et comparez avec la reference.",
				"low": f"Cet exercice de {exercise_type} demande encore de la revision. Reprenez la reference et concentrez-vous sur les mots cles, la grammaire ou la prononciation qui ont change le sens.",
			},
			"spa": {
				"correct": f"Buen trabajo en este ejercicio de {exercise_type}. Tu respuesta es correcta y el siguiente paso es mejorar aun mas la claridad y naturalidad.",
				"close": f"Estas cerca en este ejercicio de {exercise_type}. Revisa las pequenas diferencias con la respuesta de referencia, sobre todo vocabulario y fluidez.",
				"mid": f"Tienes la idea principal en este ejercicio de {exercise_type}, pero parte de la respuesta necesita correccion. Enfocate en la estructura y compara con la referencia.",
				"low": f"Este ejercicio de {exercise_type} necesita mas revision. Intenta de nuevo con la referencia y enfocate en palabras clave, gramatica o pronunciacion que cambiaron el sentido.",
			},
		}

		selected = templates.get(source_lang_code, templates["eng"])

		if correct:
			return selected["correct"]

		if score >= 0.75:
			return selected["close"]

		if score >= 0.5:
			return selected["mid"]

		return selected["low"]

	def generate_feedback(
		self,
		ex_id: str,
		user_input: str,
		input_type: str,
		target_lang_code: str,
		source_lang_code: str,
		results: dict[str, object],
		threshold: float,
		correct_audio_index: int = 0,
		session: Optional[Session] = None,
		exercise=None,
	) -> str:
		if exercise is None:
			exercise = exercise_service.get_by_id(ex_id, session=session)
			if not exercise:
				logger.warning(f"Exercise item not found when generating feedback: {ex_id}")
				return self._fallback_feedback({
					"score": results.get("score", 0.0),
					"correct": results.get("score", 0.0) > threshold,
					"exercise_type": input_type,
				})

		context: dict[str, object] = {
			"exercise_id": ex_id,
			"exercise_type": exercise.exercise_type,
			"question": exercise.question,
			"input_type": input_type,
			"score": round(float(results.get("score", 0.0) or 0.0), 3),
			"threshold": threshold,
			"correct": bool(results.get("score", 0.0) > threshold),
			"user_input": results.get("user_transcription", user_input) if input_type == "speech" else results.get("user_answer", user_input),
			"reference_answer": results.get("correct_transcription", exercise.answer) if input_type == "speech" else results.get("correct_answer", exercise.answer),
			"target_lang_code": target_lang_code,
			"source_lang_code": source_lang_code,
			"metrics": {
				key: value
				for key, value in results.items()
				if key not in {"score", "correct", "feedback"}
			},
		}

		if input_type == "speech":
			context["correct_audio_index"] = correct_audio_index

		lesson = getattr(exercise, "lesson", None)
		if lesson:
			language = getattr(lesson, "language", None)
			user_id = getattr(language, "user_id", None) if language else None
		else:
			user_id = None
		if not user_id:
			logger.warning("Cannot resolve user_id from exercise %s — lesson=%s language=%s", ex_id, lesson, language if lesson else None)
			return self._fallback_feedback(context)
		prefs = user_preferences_service.get_by_user_id(user_id, session=session)
		if prefs is not None and prefs.ai_feedback_enabled is False:
			return self._fallback_feedback(context)

		api = gated_api(prefs, "text_gen") if prefs else None
		return self._generate_with_model(context, api=api)
