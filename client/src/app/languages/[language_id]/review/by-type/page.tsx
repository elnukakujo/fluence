import { redirect } from "next/navigation";

/** The old "Review by type" page: its place is now the Type tab of the custom review (RE-14). */
export default async function ReviewByTypeRedirect({ params }: { params: Promise<{ language_id: string }> }) {
    const { language_id } = await params;
    redirect(`/languages/${language_id}/review/custom`);
}
