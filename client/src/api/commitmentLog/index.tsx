import { BASE_URL, getAuthHeaders } from "..";
import CommitmentLog from "@/interface/dataCollection/CommitmentLog";

export async function getCommitmentLogForUserLanguage(userId: string, languageId: string): Promise<CommitmentLog | null> {
  const res = await fetch(`${BASE_URL}/api/commitment-log/user/${userId}/language/${languageId}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch commitment log for ${userId}/${languageId}`);
  }
  return res.json();
}

export async function getAllCommitmentLogsForUser(userId: string) {
  const res = await fetch(`${BASE_URL}/api/commitment-log/user/${userId}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch commitment logs for ${userId}`);
  return res.json();
}
