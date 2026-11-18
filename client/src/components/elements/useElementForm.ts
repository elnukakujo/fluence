import { useState } from "react";
import { useRouter } from "next/navigation";
import ConflictError from "@/api/conflictError";

type OnConflict = "keep" | "overwrite" | "merge";
type Existing = { id?: string; tags?: { id?: string }[]; sources?: { id?: string }[] };

export type ConflictProps = {
    error: ConflictError;
    onKeep: () => void;
    onOverwrite: () => void;
    onManualResolve: (resolved: Record<string, string>) => void;
    onCancel: () => void;
};

/** What the vocabulary, grammar and calligraphy forms share: tag and source selection, create-or-update, the return to the lesson,
 *  the failure alerts and the duplicate (409) resolution flow. A form keeps its own fields and says how to build its payload. */
export function useElementForm<T extends Existing>({ existing, lessonId, noun, messages, onDone, build, create, update, mergeInto }: {
    existing?: Partial<T>;
    onDone?: () => void;                                             // given (a review's edit dialog): called instead of going back to the lesson
    lessonId: string;
    noun: string;                                                    // for the console message: "vocabulary"
    messages: { createFailure: string; updateFailure: string; resolveConflictError?: string };
    build: (shared: { lesson_id: string; tags: { id: string }[]; sources: { id: string }[] }) => Partial<T>;
    create: (element: Partial<T>, onConflict?: OnConflict) => Promise<unknown>;
    update: (id: string, element: Partial<T>) => Promise<unknown>;
    mergeInto?: (element: Partial<T>, resolved: Record<string, string>) => void;   // where a manual resolution's fields land (the word / the character)
}) {
    const router = useRouter();
    const isUpdate = Boolean(existing?.id);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(existing?.tags ? existing.tags.map((tag) => tag.id!) : []);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(existing?.sources ? existing.sources.map((source) => source.id!) : []);
    const [conflict, setConflict] = useState<ConflictError | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const buildElement = () => build({
        lesson_id: lessonId,
        tags: selectedTagIds.map((id) => ({ id })),
        sources: selectedSourceIds.map((id) => ({ id })),
    });

    const submit = async (element: Partial<T>, onConflict?: OnConflict) => {
        if (isUpdate) await update(existing!.id!, element);
        else await create(element, onConflict);
        if (onDone) return onDone();
        const languageId = window.location.pathname.split("/")[2];   // from /languages/LANG_ID/...
        router.push(`/languages/${languageId}/lesson/${lessonId}`);
        router.refresh();
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const element = buildElement();
        setIsSubmitting(true);
        try {
            await submit(element);
        } catch (error) {
            if (error instanceof ConflictError) {
                setConflict(error);
                return;
            }
            console.error(`Failed to ${isUpdate ? "update" : "create"} ${noun}:`, error);
            alert(isUpdate ? messages.updateFailure : messages.createFailure);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resolveConflict = async (element: Partial<T>, onConflict: OnConflict) => {
        setConflict(null);
        setIsSubmitting(true);
        try {
            await submit(element, onConflict);
        } catch (error) {
            console.error(`Failed to resolve ${noun} conflict:`, error);
            alert(messages.resolveConflictError);
        } finally {
            setIsSubmitting(false);
        }
    };

    const conflictProps: ConflictProps | null = conflict && {
        error: conflict,
        onKeep: () => resolveConflict(buildElement(), "keep"),
        onOverwrite: () => resolveConflict(buildElement(), "overwrite"),
        onManualResolve: (resolved) => {
            const element = buildElement();
            mergeInto?.(element, resolved);
            resolveConflict(element, "merge");
        },
        onCancel: () => setConflict(null),
    };

    return { isUpdate, selectedTagIds, setSelectedTagIds, selectedSourceIds, setSelectedSourceIds, isSubmitting, handleSubmit, conflictProps };
}
