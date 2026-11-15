import { apiFetch, ApiError } from "../apiFetch";
import CommitmentLog from "@/interface/dataCollection/CommitmentLog";

export async function getCommitmentLogForUserLanguage(userId: string, languageId: string): Promise<CommitmentLog | null> {
  try {
    return await apiFetch(`/api/commitment-log/user/${userId}/language/${languageId}`, {
      errorMessage: `Failed to fetch commitment log for ${userId}/${languageId}`,
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function getAllCommitmentLogsForUser(userId: string) {
  return apiFetch(`/api/commitment-log/user/${userId}`, {
    errorMessage: `Failed to fetch commitment logs for ${userId}`,
  });
}
