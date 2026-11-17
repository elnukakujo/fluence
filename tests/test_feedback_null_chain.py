def test_generate_feedback_with_null_lesson():
    """Exercise with lesson=None returns fallback feedback, not exception."""
    from lapp.services.feedback import FeedbackService

    svc = FeedbackService()

    class NullLessonExercise:
        lesson = None
        exercise_type = "translate"
        question = "¿Cómo estás?"
        answer = "How are you?"

    score = 0.5
    result = svc.generate_feedback(
        ex_id="ex_test_null",
        user_input="test",
        input_type="text",
        target_lang_code="en",
        source_lang_code="es",
        results={
            "similarity": score,
            "grammar_error_rate": 1.0,
            "token_difference_rate": 0.5,
            "score": score,
            "user_answer": "How is you?",
            "correct_answer": "How are you?",
        },
        threshold=0.6,
        correct_audio_index=0,
        session=None,
        exercise=NullLessonExercise(),
    )
    assert isinstance(result, str)
    assert len(result) > 0
