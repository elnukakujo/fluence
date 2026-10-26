import { redirect } from "next/navigation";
import { getAllUserSources } from "@/api/source";
import NavButton from "@/components/layout/navButton";
import Source from "@/interface/systemData/Source";
import { getCurrentUserId } from "@/utils/user_cookie";

export default async function SourcesPage() {
    const userId: string | null = await getCurrentUserId();
    if (!userId) redirect('/');
    const sources: Source[] = await getAllUserSources(userId);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-baseline">
                <h1>Sources</h1>
                <NavButton path="/sources/new">+ New</NavButton>
            </div>

            {sources.length === 0 ? (
                <p className="text-muted">No sources yet.</p>
            ) : (
                <ul className="card list-none flex flex-col gap-1">
                    {sources.map((source) => (
                    <li key={source.id}>
                        <NavButton path={`/sources/${source.id}`} className="flex items-center gap-2.5 px-2 py-1.5 w-full rounded-md cursor-pointer transition-colors hover:bg-accent-soft">
                        <span className="badge shrink-0" />
                        <span className="text-sm">{source.title}</span>
                        {source.description && (
                            <span className="text-xs text-muted ml-auto truncate">{source.description}</span>
                        )}
                        </NavButton>
                    </li>
                    ))}
                </ul>
            )}
        </div>
    );
}