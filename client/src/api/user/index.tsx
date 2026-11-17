import { apiFetch, ApiError } from "../apiFetch";
import User from "@/interface/systemData/User";

export async function getAllUsers() {
  return apiFetch("/api/user/", { errorMessage: "Failed to fetch users" });
}

export async function getUserById(userId: string) {
  try {
    return await apiFetch(`/api/user/${userId}`, { errorMessage: `Failed to fetch user ${userId}` });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function createUser(data: Partial<User>) {
  return apiFetch("/api/user/", { method: "POST", body: data, errorMessage: "Failed to create user" });
}

export async function updateUser(userId: string, data: Partial<User>) {
  return apiFetch(`/api/user/${userId}`, { method: "PUT", body: data, errorMessage: "Failed to update user" });
}

export async function deleteUser(userId: string) {
  await apiFetch(`/api/user/${userId}`, { method: "DELETE", errorMessage: "Failed to delete user" });
}

export async function setUserBlocked(userId: string, blocked: boolean) {
  return apiFetch(`/api/user/${userId}/block`, { method: "PUT", body: { blocked }, errorMessage: "Failed to update user" });
}

export async function setUserApproved(userId: string, approved: boolean) {
  return apiFetch(`/api/user/${userId}/approve`, { method: "PUT", body: { approved }, errorMessage: "Failed to update user" });
}

export async function updateUserPassword(userId: string, password: string) {
  return apiFetch(`/api/user/${userId}/password`, { method: "PUT", body: { password }, errorMessage: "Failed to update password" });
}

export async function login(email: string, password: string, remember: boolean = false) {
  try {
    return await apiFetch("/api/auth/login", { method: "POST", body: { email, password, remember }, errorMessage: "Login failed" });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return { error: "Invalid email or password" };
      if (err.status === 403) {
        if (err.serverMessage === "account_blocked") return { error: "This account has been blocked." };
        if (err.serverMessage === "account_pending") return { error: "This account is awaiting admin approval." };
        if (err.serverMessage === "account_locked") return { error: "Too many failed attempts. Please try again later." };
        return { error: "Access denied." };
      }
    }
    throw err;
  }
}

export async function logout() {
  await apiFetch("/api/auth/logout", { method: "POST", errorMessage: "Logout failed" });
}
