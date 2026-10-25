export const LANGUAGE_to_ISO639_2T: Record<string, string> = {
    "Catalan": "cat",
    "Chinese": "zho",
    "Croatian": "hrv",
    "Danish": "dan",
    "Dutch": "nld",
    "English": "eng",
    "Finnish": "fin",
    "French": "fra",
    "German": "deu",
    "Greek": "ell",
    "Italian": "ita",
    "Japanese": "jpn",
    "Korean": "kor",
    "Lithuanian": "lit",
    "Macedonian": "mkd",
    "Norwegian Bokmål": "nob",
    "Norwegian": "nor",
    "Polish": "pol",
    "Portuguese": "por",
    "Romanian": "ron",
    "Russian": "rus",
    "Slovenian": "slv",
    "Spanish": "spa",
    "Swedish": "swe",
    "Ukrainian": "ukr",
    "Custom": "",
    // Add more languages as needed
};

export const ISO639_2T_to_LANGUAGE: Record<string, string> = Object.fromEntries(
    Object.entries(LANGUAGE_to_ISO639_2T).map(([language, iso]) => [iso, language])
);

export const LANGUAGE_FLAGS: Record<string, string> = {
  "Catalan": "🇪🇸",
  "Chinese": "🇨🇳",
  "Croatian": "🇭🇷",
  "Danish": "🇩🇰",
  "Dutch": "🇳🇱",
  "English": "🇬🇧",
  "Finnish": "🇫🇮",
  "French": "🇫🇷",
  "German": "🇩🇪",
  "Greek": "🇬🇷",
  "Italian": "🇮🇹",
  "Japanese": "🇯🇵",
  "Korean": "🇰🇷",
  "Lithuanian": "🇱🇹",
  "Macedonian": "🇲🇰",
  "Norwegian Bokmål": "🇳🇴",
  "Norwegian": "🇳🇴",
  "Polish": "🇵🇱",
  "Portuguese": "🇵🇹",
  "Romanian": "🇷🇴",
  "Russian": "🇷🇺",
  "Slovenian": "🇸🇮",
  "Spanish": "🇪🇸",
  "Swedish": "🇸🇪",
  "Ukrainian": "🇺🇦",
};

export type CEFRLevel =
  | "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type FSIDifficulty = "I" | "II" | "III" | "IV" | "V";

export interface ProficiencyLevel {
  /** Level code as used by the test (e.g. "N1", "HSK 4", "B2") */
  code: string;
  /** Approximate CEFR equivalent, if applicable */
  cefrEquivalent?: CEFRLevel;
  /** Cumulative hours from zero to reach this level */
  cumulativeHours: { min: number; max: number };
  /** Incremental hours from the previous level (null for the first level) */
  incrementalHours: { min: number; max: number } | null;
}

export interface LanguageProficiencySystem {
  /** ISO 639-3 language code */
  isoCode: string;
  /** Official name of the language (in English) */
  englishName?: string;
  /** Official name of the proficiency test */
  testName: string;
  /** Short abbreviation (e.g. "JLPT", "DELF") */
  testAbbreviation: string;
  /** Whether this system is CEFR-based */
  cefrBased: boolean;
  /** FSI difficulty category for English native speakers (I = easiest, V = hardest) */
  fsiDifficulty: FSIDifficulty;
  /** Ordered list of levels from easiest to hardest */
  levels: ProficiencyLevel[];
  /** Approximate total hours from zero to the highest level */
  totalHoursToHighest: { min: number; max: number };
  /** Any notable caveats about the system or hour estimates */
  notes: string;
}

/**
 * Official language proficiency grading systems with estimated study hours.
 *
 * Hour estimates assume a native English speaker with no prior knowledge of the
 * target language. They are population-level approximations — individual results
 * vary significantly based on learning method, intensity, and linguistic background.
 *
 * Sources: CIA France CEFR document, Cambridge English research, Confucius Institute
 * Scotland, TOPIK Lab, Langmitra, FSI language difficulty ratings, Interac Network (JLPT).
 */
export const languageProficiencySystems: Record<string, LanguageProficiencySystem> = {

  // ─── CEFR-based · FSI Category I (easiest for English speakers) ───────────

  cat: {
    isoCode: "cat",
    englishName: "Catalan",
    testName: "Certificats de Català (DIEC / Consorci per a la Normalització Lingüística)",
    testAbbreviation: "CNLC",
    cefrBased: true,
    fsiDifficulty: "I",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 330,  max: 400  }, incrementalHours: { min: 150, max: 180 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 530,  max: 650  }, incrementalHours: { min: 200, max: 250 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 780,  max: 950  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1080, max: 1350 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1080, max: 1350 },
    notes: "Catalan is closely related to Spanish and French; speakers of either will need significantly fewer hours.",
  },

  dan: {
    isoCode: "dan",
    englishName: "Danish",
    testName: "Prøve i Dansk + Studieprøven",
    testAbbreviation: "PD",
    cefrBased: true,
    fsiDifficulty: "I",
    levels: [
      { code: "PD 1", cefrEquivalent: "A2", cumulativeHours: { min: 150, max: 200 }, incrementalHours: null },
      { code: "PD 2", cefrEquivalent: "B1", cumulativeHours: { min: 350, max: 450 }, incrementalHours: { min: 200, max: 250 } },
      { code: "PD 3", cefrEquivalent: "B2", cumulativeHours: { min: 600, max: 750 }, incrementalHours: { min: 250, max: 300 } },
      { code: "Studieprøven", cefrEquivalent: "C1", cumulativeHours: { min: 900, max: 1150 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 900, max: 1150 },
    notes: "Only 4 official exam tiers; no standardised A1 or C2 certificate. Studieprøven is the highest level tested. Danish is FSI Cat. I — among the easiest for English speakers.",
  },

  nld: {
    isoCode: "nld",
    englishName: "Dutch",
    testName: "Certificaat Nederlands als Vreemde Taal / NT2",
    testAbbreviation: "CNaVT",
    cefrBased: true,
    fsiDifficulty: "I",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 330,  max: 400  }, incrementalHours: { min: 150, max: 180 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 530,  max: 650  }, incrementalHours: { min: 200, max: 250 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 780,  max: 950  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1080, max: 1350 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1080, max: 1350 },
    notes: "FSI Cat. I. Dutch is grammatically closer to German than to English, but shares significant vocabulary with both.",
  },

  eng: {
    isoCode: "eng",
    englishName: "English",
    testName: "Cambridge English Qualifications (CEFR-aligned)",
    testAbbreviation: "Cambridge",
    cefrBased: true,
    fsiDifficulty: "I",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 60,  max: 80  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 140, max: 180 }, incrementalHours: { min: 80,  max: 100 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 290, max: 380 }, incrementalHours: { min: 150, max: 200 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 490, max: 630 }, incrementalHours: { min: 200, max: 250 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 690, max: 880 }, incrementalHours: { min: 200, max: 250 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 890, max: 1130 }, incrementalHours: { min: 200, max: 250 } },
    ],
    totalHoursToHighest: { min: 890, max: 1130 },
    notes: "Cambridge research estimates ~200 guided learning hours per full CEFR level. Fewer hours than other European languages due to widespread global exposure to English.",
  },

  nob: {
    isoCode: "nob",
    englishName: "Norwegian Bokmål",
    testName: "Norskprøven (A1–B2) + Bergenstesten (B2/C1)",
    testAbbreviation: "Norskprøven",
    cefrBased: true,
    fsiDifficulty: "I",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,  max: 100 }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180, max: 250 }, incrementalHours: { min: 100, max: 150 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 330, max: 450 }, incrementalHours: { min: 150, max: 200 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 530, max: 700 }, incrementalHours: { min: 200, max: 250 } },
      { code: "Bergenstesten", cefrEquivalent: "C1", cumulativeHours: { min: 730, max: 1000 }, incrementalHours: { min: 200, max: 300 } },
    ],
    totalHoursToHighest: { min: 730, max: 1000 },
    notes: "Norwegian Bokmål is FSI Cat. I — one of the easiest languages for English speakers. Bergenstesten covers B2–C1 and is used for academic admission. No standardised C2 exam.",
  },

  nor: {
    isoCode: "nor",
    englishName: "Norwegian",
    testName: "Norskprøven + Bergenstesten",
    testAbbreviation: "Norskprøven",
    cefrBased: true,
    fsiDifficulty: "I",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,  max: 100 }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180, max: 250 }, incrementalHours: { min: 100, max: 150 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 330, max: 450 }, incrementalHours: { min: 150, max: 200 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 530, max: 700 }, incrementalHours: { min: 200, max: 250 } },
      { code: "Bergenstesten", cefrEquivalent: "C1", cumulativeHours: { min: 730, max: 1000 }, incrementalHours: { min: 200, max: 300 } },
    ],
    totalHoursToHighest: { min: 730, max: 1000 },
    notes: "Same exam system as Norwegian Bokmål. Covers both Bokmål and Nynorsk written standards.",
  },

  swe: {
    isoCode: "swe",
    testName: "SFI (Svenska för invandrare) + TISUS",
    testAbbreviation: "SFI",
    cefrBased: true,
    fsiDifficulty: "I",
    levels: [
      { code: "SFI A", cefrEquivalent: "A1", cumulativeHours: { min: 80,  max: 100 }, incrementalHours: null },
      { code: "SFI B", cefrEquivalent: "A2", cumulativeHours: { min: 180, max: 250 }, incrementalHours: { min: 100, max: 150 } },
      { code: "SFI C", cefrEquivalent: "B1", cumulativeHours: { min: 330, max: 450 }, incrementalHours: { min: 150, max: 200 } },
      { code: "SFI D", cefrEquivalent: "B2", cumulativeHours: { min: 530, max: 700 }, incrementalHours: { min: 200, max: 250 } },
      { code: "TISUS",  cefrEquivalent: "C1", cumulativeHours: { min: 730, max: 1000 }, incrementalHours: { min: 200, max: 300 } },
    ],
    totalHoursToHighest: { min: 730, max: 1000 },
    notes: "SFI is a state integration course with 4 tracks (A–D). TISUS is an academic admission test (B2/C1), not a standard progression exam. FSI Cat. I.",
  },

  // ─── CEFR-based · FSI Category II ────────────────────────────────────────

  deu: {
    isoCode: "deu",
    englishName: "German",
    testName: "Goethe-Zertifikat / Österreichisches Sprachdiplom Deutsch",
    testAbbreviation: "Goethe",
    cefrBased: true,
    fsiDifficulty: "II",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 330,  max: 400  }, incrementalHours: { min: 150, max: 180 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 530,  max: 650  }, incrementalHours: { min: 200, max: 250 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 780,  max: 950  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1080, max: 1350 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1080, max: 1350 },
    notes: "Goethe C2 (ZOP) is officially estimated at 1,000–1,200 h total. FSI Cat. II — harder than Scandinavian languages due to case system and compound nouns.",
  },

  // ─── CEFR-based · FSI Category III (harder for English speakers) ──────────

  fra: {
    isoCode: "fra",
    englishName: "French",
    testName: "Diplôme d'Études en Langue Française / Diplôme Approfondi de Langue Française",
    testAbbreviation: "DELF/DALF",
    cefrBased: true,
    fsiDifficulty: "I",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 330,  max: 400  }, incrementalHours: { min: 150, max: 180 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 530,  max: 650  }, incrementalHours: { min: 200, max: 250 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 780,  max: 950  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1080, max: 1350 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1080, max: 1350 },
    notes: "Official CEFR hour benchmarks published by CIA France. FSI Cat. I for English speakers. DELF covers A1–B2; DALF covers C1–C2.",
  },

  ell: {
    isoCode: "ell",
    englishName: "Greek",
    testName: "Κρατικό Πιστοποιητικό Γλωσσομάθειας (State Certificate of Language Proficiency)",
    testAbbreviation: "KPG",
    cefrBased: true,
    fsiDifficulty: "III",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 330,  max: 500  }, incrementalHours: { min: 150, max: 280 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 530,  max: 750  }, incrementalHours: { min: 200, max: 250 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 780,  max: 1050 }, incrementalHours: { min: 250, max: 300 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1080, max: 1350 }, incrementalHours: { min: 300, max: 300 } },
    ],
    totalHoursToHighest: { min: 1080, max: 1350 },
    notes: "FSI Cat. III. Greek alphabet and different phonology add overhead at the A1–A2 stage vs. Latin-script CEFR languages.",
  },

  ita: {
    isoCode: "ita",
    englishName: "Italian",
    testName: "Certificazione di Italiano come Lingua Straniera / Certificato di Conoscenza della Lingua Italiana",
    testAbbreviation: "CILS/CELI",
    cefrBased: true,
    fsiDifficulty: "I",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 330,  max: 400  }, incrementalHours: { min: 150, max: 180 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 530,  max: 650  }, incrementalHours: { min: 200, max: 250 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 780,  max: 950  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1080, max: 1350 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1080, max: 1350 },
    notes: "FSI Cat. I. Multiple competing certificates: CILS (Università per Stranieri di Siena), CELI (Università per Stranieri di Perugia), PLIDA (Società Dante Alighieri).",
  },

  fin: {
    isoCode: "fin",
    englishName: "Finnish",
    testName: "Yleinen kielitutkinto (General Language Examination)",
    testAbbreviation: "YKI",
    cefrBased: true,
    fsiDifficulty: "IV",
    levels: [
      { code: "YKI 1", cefrEquivalent: "A1", cumulativeHours: { min: 100,  max: 120  }, incrementalHours: null },
      { code: "YKI 2", cefrEquivalent: "A2", cumulativeHours: { min: 220,  max: 270  }, incrementalHours: { min: 120, max: 150 } },
      { code: "YKI 3", cefrEquivalent: "B1", cumulativeHours: { min: 400,  max: 520  }, incrementalHours: { min: 180, max: 250 } },
      { code: "YKI 4", cefrEquivalent: "B2", cumulativeHours: { min: 650,  max: 870  }, incrementalHours: { min: 250, max: 350 } },
      { code: "YKI 5", cefrEquivalent: "C1", cumulativeHours: { min: 950,  max: 1270 }, incrementalHours: { min: 300, max: 400 } },
      { code: "YKI 6", cefrEquivalent: "C2", cumulativeHours: { min: 1350, max: 1770 }, incrementalHours: { min: 400, max: 500 } },
    ],
    totalHoursToHighest: { min: 1350, max: 1770 },
    notes: "Finnish is FSI Cat. IV (~1,100 h to professional level). Agglutinative morphology and 15 grammatical cases make it particularly demanding. YKI is administered at 3 tiers: basic (A1–A2), middle (B1–B2), upper (C1–C2).",
  },

  pol: {
    isoCode: "pol",
    englishName: "Polish",
    testName: "Certyfikat Znajomości Języka Polskiego",
    testAbbreviation: "Certyfikat",
    cefrBased: true,
    fsiDifficulty: "III",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 380,  max: 500  }, incrementalHours: { min: 200, max: 280 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 630,  max: 800  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 930,  max: 1150 }, incrementalHours: { min: 300, max: 350 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1230, max: 1550 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1230, max: 1550 },
    notes: "FSI Cat. III (~1,100 h). Polish has complex case system (7 cases) and consonant clusters that significantly slow early progress.",
  },

  por: {
    isoCode: "por",
    englishName: "Portuguese",
    testName: "Centro de Avaliação de Português Língua Estrangeira",
    testAbbreviation: "CAPLE",
    cefrBased: true,
    fsiDifficulty: "I",
    levels: [
      { code: "A1 (CIPLE)", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2 (DEPLE)", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1 (DIPLE)", cefrEquivalent: "B1", cumulativeHours: { min: 330,  max: 400  }, incrementalHours: { min: 150, max: 180 } },
      { code: "B2 (DUPLE)", cefrEquivalent: "B2", cumulativeHours: { min: 530,  max: 650  }, incrementalHours: { min: 200, max: 250 } },
      { code: "C1 (DAPLE)", cefrEquivalent: "C1", cumulativeHours: { min: 780,  max: 950  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C2 (DUPLE)", cefrEquivalent: "C2", cumulativeHours: { min: 1080, max: 1350 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1080, max: 1350 },
    notes: "FSI Cat. I. Each CAPLE level has its own certificate acronym (CIPLE, DEPLE, DIPLE, etc.). Brazilian Portuguese learners may use CELPE-Bras instead.",
  },

  ron: {
    isoCode: "ron",
    englishName: "Romanian",
    testName: "CEFR-aligned state examinations (no single dominant body)",
    testAbbreviation: "CEFR",
    cefrBased: true,
    fsiDifficulty: "II",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 330,  max: 400  }, incrementalHours: { min: 150, max: 180 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 530,  max: 650  }, incrementalHours: { min: 200, max: 250 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 780,  max: 950  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1080, max: 1350 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1080, max: 1350 },
    notes: "Romanian is a Romance language but uses some Slavic vocabulary. No single dominant proficiency body; hour estimates follow standard CEFR benchmarks.",
  },

  rus: {
    isoCode: "rus",
    englishName: "Russian",
    testName: "Test of Russian as a Foreign Language / Тест по русскому языку как иностранному",
    testAbbreviation: "TORFL/ТРКИ",
    cefrBased: true,
    fsiDifficulty: "IV",
    levels: [
      { code: "A1 (Элементарный)",  cefrEquivalent: "A1", cumulativeHours: { min: 100,  max: 120  }, incrementalHours: null },
      { code: "A2 (Базовый)",       cefrEquivalent: "A2", cumulativeHours: { min: 220,  max: 270  }, incrementalHours: { min: 120, max: 150 } },
      { code: "B1 (I сертификационный)", cefrEquivalent: "B1", cumulativeHours: { min: 420,  max: 520  }, incrementalHours: { min: 200, max: 250 } },
      { code: "B2 (II сертификационный)", cefrEquivalent: "B2", cumulativeHours: { min: 670,  max: 820  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C1 (III сертификационный)", cefrEquivalent: "C1", cumulativeHours: { min: 970,  max: 1220 }, incrementalHours: { min: 300, max: 400 } },
      { code: "C2 (IV сертификационный)", cefrEquivalent: "C2", cumulativeHours: { min: 1370, max: 1720 }, incrementalHours: { min: 400, max: 500 } },
    ],
    totalHoursToHighest: { min: 1370, max: 1720 },
    notes: "FSI Cat. IV (~1,100 h to professional level). Cyrillic script, complex morphology (6 cases, aspect pairs), and free word order add significant overhead at lower levels.",
  },

  spa: {
    isoCode: "spa",
    englishName: "Spanish",
    testName: "Diplomas de Español como Lengua Extranjera",
    testAbbreviation: "DELE",
    cefrBased: true,
    fsiDifficulty: "I",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 330,  max: 400  }, incrementalHours: { min: 150, max: 180 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 530,  max: 650  }, incrementalHours: { min: 200, max: 250 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 780,  max: 950  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1080, max: 1350 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1080, max: 1350 },
    notes: "Administered by Instituto Cervantes. FSI Cat. I — one of the fastest European languages to learn for English speakers.",
  },

  ukr: {
    isoCode: "ukr",
    englishName: "Ukrainian",
    testName: "CEFR-aligned state examinations (no single dominant body)",
    testAbbreviation: "CEFR",
    cefrBased: true,
    fsiDifficulty: "III",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 380,  max: 470  }, incrementalHours: { min: 200, max: 250 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 630,  max: 770  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 930,  max: 1120 }, incrementalHours: { min: 300, max: 350 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1230, max: 1520 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1230, max: 1520 },
    notes: "Slavic language with Cyrillic script; similar difficulty to Russian for English speakers. No single dominant certification body as of 2025.",
  },

  // ─── CEFR-based · smaller/no single dominant body ─────────────────────────

  hrv: {
    isoCode: "hrv",
    englishName: "Croatian",
    testName: "CEFR-aligned examinations (no single dominant body)",
    testAbbreviation: "CEFR",
    cefrBased: true,
    fsiDifficulty: "III",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 380,  max: 470  }, incrementalHours: { min: 200, max: 250 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 630,  max: 770  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 930,  max: 1120 }, incrementalHours: { min: 300, max: 350 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1230, max: 1520 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1230, max: 1520 },
    notes: "South Slavic language; 7 cases, complex verb aspect system. Mutually intelligible with Serbian and Bosnian.",
  },

  lit: {
    isoCode: "lit",
    englishName: "Lithuanian",
    testName: "CEFR-aligned state examinations",
    testAbbreviation: "CEFR",
    cefrBased: true,
    fsiDifficulty: "III",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 100,  max: 130  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 220,  max: 280  }, incrementalHours: { min: 120, max: 150 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 420,  max: 530  }, incrementalHours: { min: 200, max: 250 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 670,  max: 830  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 970,  max: 1180 }, incrementalHours: { min: 300, max: 350 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1270, max: 1580 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1270, max: 1580 },
    notes: "Baltic language; one of the most archaic living Indo-European languages. Complex morphology with 7 cases. No widely recognised single certification body.",
  },

  mkd: {
    isoCode: "mkd",
    englishName: "Macedonian",
    testName: "CEFR-aligned examinations (no single dominant body)",
    testAbbreviation: "CEFR",
    cefrBased: true,
    fsiDifficulty: "III",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 380,  max: 470  }, incrementalHours: { min: 200, max: 250 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 630,  max: 770  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 930,  max: 1120 }, incrementalHours: { min: 300, max: 350 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1230, max: 1520 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1230, max: 1520 },
    notes: "South Slavic language written in Cyrillic. Closely related to Bulgarian. No single official certification body with international reach.",
  },

  slv: {
    isoCode: "slv",
    englishName: "Slovenian",
    testName: "CEFR-aligned state examinations",
    testAbbreviation: "CEFR",
    cefrBased: true,
    fsiDifficulty: "III",
    levels: [
      { code: "A1", cefrEquivalent: "A1", cumulativeHours: { min: 80,   max: 100  }, incrementalHours: null },
      { code: "A2", cefrEquivalent: "A2", cumulativeHours: { min: 180,  max: 220  }, incrementalHours: { min: 100, max: 120 } },
      { code: "B1", cefrEquivalent: "B1", cumulativeHours: { min: 380,  max: 470  }, incrementalHours: { min: 200, max: 250 } },
      { code: "B2", cefrEquivalent: "B2", cumulativeHours: { min: 630,  max: 770  }, incrementalHours: { min: 250, max: 300 } },
      { code: "C1", cefrEquivalent: "C1", cumulativeHours: { min: 930,  max: 1120 }, incrementalHours: { min: 300, max: 350 } },
      { code: "C2", cefrEquivalent: "C2", cumulativeHours: { min: 1230, max: 1520 }, incrementalHours: { min: 300, max: 400 } },
    ],
    totalHoursToHighest: { min: 1230, max: 1520 },
    notes: "South Slavic language with dual grammatical number and 6 cases. Administered by the Centre for Slovenian as a Second and Foreign Language (CJNK).",
  },

  // ─── East Asian non-CEFR systems · FSI Category V ─────────────────────────

  jpn: {
    isoCode: "jpn",
    englishName: "Japanese",
    testName: "Japanese Language Proficiency Test / 日本語能力試験",
    testAbbreviation: "JLPT",
    cefrBased: false,
    fsiDifficulty: "V",
    levels: [
      {
        code: "N5",
        cefrEquivalent: "A1",
        cumulativeHours: { min: 250, max: 600 },
        incrementalHours: null,
      },
      {
        code: "N4",
        cefrEquivalent: "A2",
        cumulativeHours: { min: 450, max: 1000 },
        incrementalHours: { min: 200, max: 400 },
      },
      {
        code: "N3",
        cefrEquivalent: "B1",
        cumulativeHours: { min: 750, max: 1500 },
        incrementalHours: { min: 300, max: 500 },
      },
      {
        code: "N2",
        cefrEquivalent: "B2",
        cumulativeHours: { min: 1250, max: 2400 },
        incrementalHours: { min: 500, max: 900 },
      },
      {
        code: "N1",
        cefrEquivalent: "C1",
        cumulativeHours: { min: 1700, max: 4800 },
        incrementalHours: { min: 600, max: 1200 },
      },
    ],
    totalHoursToHighest: { min: 1700, max: 4800 },
    notes: "FSI Cat. V — hardest tier for English speakers. The extremely wide ranges reflect whether the learner has prior kanji knowledge (e.g. Chinese speakers) or not. N1 is broadly considered C1; C2 has no JLPT equivalent. JLPT does not include a speaking component.",
  },

  kor: {
    isoCode: "kor",
    englishName: "Korean",
    testName: "Test of Proficiency in Korean / 한국어능력시험",
    testAbbreviation: "TOPIK",
    cefrBased: false,
    fsiDifficulty: "V",
    levels: [
      {
        code: "Level 1",
        cefrEquivalent: "A1",
        cumulativeHours: { min: 200, max: 300 },
        incrementalHours: null,
      },
      {
        code: "Level 2",
        cefrEquivalent: "A2",
        cumulativeHours: { min: 400, max: 600 },
        incrementalHours: { min: 200, max: 300 },
      },
      {
        code: "Level 3",
        cefrEquivalent: "B1",
        cumulativeHours: { min: 600, max: 900 },
        incrementalHours: { min: 200, max: 300 },
      },
      {
        code: "Level 4",
        cefrEquivalent: "B2",
        cumulativeHours: { min: 900, max: 1300 },
        incrementalHours: { min: 300, max: 400 },
      },
      {
        code: "Level 5",
        cefrEquivalent: "C1",
        cumulativeHours: { min: 1300, max: 1800 },
        incrementalHours: { min: 400, max: 500 },
      },
      {
        code: "Level 6",
        cefrEquivalent: "C2",
        cumulativeHours: { min: 1700, max: 2300 },
        incrementalHours: { min: 400, max: 500 },
      },
    ],
    totalHoursToHighest: { min: 1700, max: 2300 },
    notes: "FSI Cat. V. TOPIK I covers Levels 1–2; TOPIK II covers Levels 3–6. Hangul script is learnable in 1–2 weeks. CEFR mapping: Lvl 1 ≈ A1, Lvl 2 ≈ A2, Lvl 3 ≈ B1, Lvl 4 ≈ B2, Lvl 5 ≈ C1, Lvl 6 ≈ C2.",
  },

  zho: {
    isoCode: "zho",
    englishName: "Mandarin Chinese",
    testName: "Hanyu Shuiping Kaoshi / 汉语水平考试",
    testAbbreviation: "HSK",
    cefrBased: false,
    fsiDifficulty: "V",
    levels: [
      // Using the widely-adopted old 6-level system (HSK 2.0).
      // HSK 3.0 (2021) introduced 9 levels; hours are noted below.
      {
        code: "HSK 1",
        cefrEquivalent: "A1",
        cumulativeHours: { min: 80, max: 100 },
        incrementalHours: null,
      },
      {
        code: "HSK 2",
        cefrEquivalent: "A2",
        cumulativeHours: { min: 180, max: 300 },
        incrementalHours: { min: 100, max: 200 },
      },
      {
        code: "HSK 3",
        cefrEquivalent: "B1",
        cumulativeHours: { min: 380, max: 700 },
        incrementalHours: { min: 200, max: 400 },
      },
      {
        code: "HSK 4",
        cefrEquivalent: "B2",
        cumulativeHours: { min: 780, max: 1300 },
        incrementalHours: { min: 400, max: 600 },
      },
      {
        code: "HSK 5",
        cefrEquivalent: "C1",
        cumulativeHours: { min: 1180, max: 1900 },
        incrementalHours: { min: 400, max: 600 },
      },
      {
        code: "HSK 6",
        cefrEquivalent: "C2",
        cumulativeHours: { min: 1680, max: 2600 },
        incrementalHours: { min: 500, max: 700 },
      },
    ],
    totalHoursToHighest: { min: 1680, max: 2600 },
    notes: "FSI Cat. V (~2,200 h to professional level). Uses HSK 2.0 (6 levels) which remains the most widely tested. HSK 3.0 (2021) expands to 9 levels: HSK 1–3 ≈ A1–B1, HSK 4–6 ≈ B2–C2, HSK 7–9 ≈ C2+. Official Confucius Institute figures: HSK 1 = 40–80 h, HSK 2 = 80–120 h, HSK 3 = 120–180 h. Wide ranges reflect whether learner has prior character knowledge (e.g. Japanese speakers).",
  },
};

/** Safe level label: the proficiency code when known, else a clean fallback.
 *  Guards the out-of-range index that used to crash LevelDisplay. */
export function getLevelLabel(
  system: LanguageProficiencySystem | undefined,
  level: number | null | undefined,
): string {
  const idx = level ?? -1;
  const code = system?.levels?.[idx]?.code;
  return code ?? (idx >= 0 ? `Level ${idx + 1}` : "—");
}