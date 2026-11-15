import { getUserById } from "@/api/user";
import { getCurrentUserId } from "@/utils/user_cookie";
import type { VocSidePattern } from "@/interface/systemData/UserPreferences";

/** The signed-in user's saved order setting; null (never set, or no session) means the default, random. */
export async function getSidePattern(): Promise<VocSidePattern | null> {
    const id = await getCurrentUserId();
    const user = id ? await getUserById(id) : null;
    return user?.preferences?.voc_side_pattern ?? null;
}
