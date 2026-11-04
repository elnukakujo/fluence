// Exercise type ids (sent to the API) -> key in the `exercises` message namespace.
export const EXERCISE_TYPE_KEY: Record<string, string> = {
  essay: "essay", answering: "answering", translate: "translate", organize: "organize",
  conversation: "conversation", type_in_the_blank: "typeInTheBlank", select_in_the_blank: "selectInTheBlank",
  matching: "matching", true_false: "trueFalse", speaking: "speaking", quizz: "quizz", reading: "reading", dictation: "dictation",
};
