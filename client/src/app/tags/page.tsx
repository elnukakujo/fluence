import { redirect } from "next/navigation";
import { getAllUserTags } from "@/api/tag";
import Tag from "@/interface/systemData/Tag";
import NavButton from "@/components/layout/navButton";
import { getCurrentUserId } from "@/utils/user_cookie";

export default async function TagsPage() {
    const userId: string | null = await getCurrentUserId();
    if (!userId) redirect('/');
    const tags: Tag[] = await getAllUserTags(userId);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-baseline">
                <h1>Tags</h1>
                <NavButton path="/tags/new">+ New</NavButton>
            </div>

            {tags.length === 0 ? (
                <p className="text-muted">No tags yet.</p>
            ) : (
                <ul className="card list-none flex flex-col gap-1">
                    {tags.map((tag) => (
                    <li key={tag.id}>
                        <NavButton path={`/tags/${tag.id}`} className="flex items-center gap-2.5 px-2 py-1.5 w-full rounded-md cursor-pointer transition-colors hover:bg-accent-soft">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="text-sm">{tag.name}</span>
                        {tag.description && (
                            <span className="text-xs text-muted ml-auto truncate">{tag.description}</span>
                        )}
                        </NavButton>
                    </li>
                    ))}
                </ul>
            )}
        </div>
    );
}