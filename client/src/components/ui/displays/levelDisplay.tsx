import {languageProficiencySystems, getLevelLabel} from '@/utils/language_iso639';

interface LevelDisplayProps {
  levelIdx: number; // 0-based index into the proficiency system's levels
  language_iso639_1: string; // actually the ISO 639-2T code (e.g. "jpn")
}

export default function LevelDisplay({ levelIdx, language_iso639_1 }: LevelDisplayProps) {
    const level_code = getLevelLabel(languageProficiencySystems[language_iso639_1], levelIdx);

    return (
        <div className="inline-flex items-center gap-2">
            <span className="text-sm text-muted">Level</span>

            <span className={`text-xs font-medium level-${levelIdx}`}>
                {level_code}
            </span>
        </div>
    );
}