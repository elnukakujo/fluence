"use client";

import type Exercise from "@/interface/features/Exercise";
import { useEffect, useState } from "react";
import { useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
import { updateScoreById } from "@/api/process";
import shuffle from 'lodash/shuffle';
import ElementMediaCard from "@/components/elements/elementMediaCard";
import MissingContentNotice from "./missingContentNotice";

type Item = {
    value: string;
    column: number;
};

export default function MatchingExercise({ exercise }: { exercise: Exercise }) {
    const t = useTranslations("exercises");
    const content = exercise.content as { pairs: [string, string][] } | null;
    const text_support = exercise.text_support || "";

    const pairs: Item[][] = (content?.pairs ?? [["", ""]]).map(row =>
        row.map((value, colIndex) => ({ value, column: colIndex }))
    );

    const [remainingPairs, setRemainingPairs] = useState<Item[][]>(pairs);

    const numColumns = pairs[0].length;

    const [shuffledPairs, setShuffledPairs] = useState<Item[][]>([]);
    const startTimeRef = useRef<number>(performance.now());

    useEffect(() => {
        // Shuffle each column independently
        const shuffledColumns = Array.from({ length: numColumns }, (_, colIndex) => {
            const column = pairs.map(row => row[colIndex]);
            return shuffle(column); // lodash shuffle
        });

        // Reconstruct rows from shuffled columns
        const newPairs: Item[][] = pairs.map((_, rowIndex) =>
            shuffledColumns.map(column => column[rowIndex])
        );

        setShuffledPairs(newPairs);
        setRemainingPairs(pairs);
        setAttempts(3);
        setSelection([]);
        setMatchOrder(new Map());
        setIsSuccess(false);
        startTimeRef.current = performance.now();
    }, [exercise]);

    const [attempts, setAttempts] = useState<number>(3);
    const [selection, setSelection] = useState<Array<Item>>([]);
    const [matchOrder, setMatchOrder] = useState<Map<string, number>>(new Map());
    const [shake, setShake] = useState<boolean>(false);

    if (!content) return <MissingContentNotice />;

    const itemKey = (item: Item) => `${item.column}:${item.value}`;

    const handleClick = (item: Item) => {
        // Remove old selection from the same column
        const updatedSelection = selection.filter(sel => sel.column !== item.column);

        const newSelection = [...updatedSelection, item];

        // Build string from values
        const newSelectionString = newSelection.map(sel => sel.value).join('');

        // Check against full pairs and partial prefixes
        const matchedPair = remainingPairs.find(pair =>
            pair.map(p => p.value).join('') === newSelectionString
        );
        const isFullMatch = !!matchedPair;

        const isPartialMatch = remainingPairs.some(pair =>
            pair.map(p => p.value).join('').startsWith(newSelectionString)
        );
        if (isFullMatch && matchedPair) {
            if (remainingPairs.length === 1) {
                setIsSuccess(true);
            }
            // Remove the full matched pair from remainingPairs
            setRemainingPairs(prevRemaining =>
                prevRemaining.filter(pair => pair.map(p => p.value).join('') !== newSelectionString)
            );
            setMatchOrder(prev => {
                const next = new Map(prev);
                const order = next.size;
                matchedPair.forEach(p => next.set(itemKey(p), order));
                return next;
            });
            setSelection([]);
        } else if (isPartialMatch) {
            setSelection(newSelection);
        } else {
            setAttempts(prev => prev - 1);
            setSelection([]);
            setShake(true);
            setTimeout(() => setShake(false), 300);
        }
    };

    const [isSuccess, setIsSuccess] = useState<boolean>(false);

    useEffect(() => {
        if (isSuccess) {
            const duration_ms = Math.round(performance.now() - startTimeRef.current);
            updateScoreById(exercise.id!, 1, duration_ms, false, 4 - attempts).catch(console.error);
        };
    }, [isSuccess, exercise]);

    return (
        <form className="card flex flex-col space-y-4">
            {text_support.trim() !== "" && (
                <section>
                    <h3>{t("textSupport")} </h3>
                    <Markdown remarkPlugins={[remarkGfm]}>{text_support}</Markdown>
                </section>
            )}
            <ElementMediaCard element={exercise}/>

            {(!isSuccess && attempts > 0) &&
                <section className={`index-divider w-full max-w-[32rem] mx-auto flex flex-row space-x-5 ${shake ? 'animate-shake' : ''}`}>
                    {Array.from({ length: numColumns }, (_, colIndex) => (
                        <div key={colIndex} className="flex flex-col space-y-2 justify-around mb-2 flex-1">
                            {shuffledPairs.map((row, rowIndex) => {
                                const item = row[colIndex];
                                const isSelected = selection.includes(item);
                                const order = matchOrder.get(itemKey(item));
                                const isMatched = order !== undefined;
                                return (
                                    <button
                                        type="button"
                                        key={rowIndex}
                                        onClick={() => handleClick(item)}
                                        className={`chip w-fit transition-transform duration-150 ${
                                            isMatched
                                                ? 'border border-success/40 bg-success/10 text-success cursor-default'
                                                : isSelected
                                                    ? 'bg-accent text-primary-foreground scale-105'
                                                    : ''
                                        }`}
                                        disabled={
                                            isMatched ||
                                            selection.map(sel => sel.column).includes(colIndex) ||
                                            attempts < 0
                                        }
                                    >
                                        {isMatched && (
                                            <span className="badge bg-success/20 text-success">{order! + 1}</span>
                                        )}
                                        {item.value}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </section>
            }

            {attempts <= 2 && attempts > 0 && !isSuccess && (
                <div className="card mt-4 border-danger/30 bg-danger/10 text-danger">
                    <p>{t("attemptsLeftMatching", { attempts })}</p>
                </div>
            )}

            {attempts < 0 && (
                <div className="card mt-4 border-danger/30 bg-danger/10 text-danger">
                    <p>{t("outOfAttempts")}</p>
                    <ul>
                        {pairs.map((pair, index) => (
                            <li key={index}>{pair.map(item => item.value).join(' - ')}</li>
                        ))}
                    </ul>
                </div>
            )}

            {isSuccess && (
                <div className="card mt-4 border-success/30 bg-success/10 text-success">
                    <p>{t("wellDone")}</p>
                </div>
            )}
        </form>
    );
}
