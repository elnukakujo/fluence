import { BASE_URL, getAuthHeaders } from "..";
import User from "@/interface/systemData/User";

export async function getAllUsers() {
  const res = await fetch(`${BASE_URL}/api/user/`, {
    method: "GET",
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function getUserById(userId: string) {
  const res = await fetch(`${BASE_URL}/api/user/${userId}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch user ${userId}`);
  return res.json();
}

export async function createUser(data: Partial<User>) {
  const res = await fetch(`${BASE_URL}/api/user/`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create user");
  return res.json();
}

export async function updateUser(userId: string, data: Partial<User>) {
  const res = await fetch(`${BASE_URL}/api/user/${userId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update user");
  return res.json();
}

export async function deleteUser(userId: string) {
  const res = await fetch(`${BASE_URL}/api/user/${userId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete user");
}

export async function setUserBlocked(userId: string, blocked: boolean) {
  const res = await fetch(`${BASE_URL}/api/user/${userId}/block`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ blocked }),
  });
  if (!res.ok) throw new Error("Failed to update user");
  return res.json();
}

export async function setUserApproved(userId: string, approved: boolean) {
  const res = await fetch(`${BASE_URL}/api/user/${userId}/approve`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ approved }),
  });
  if (!res.ok) throw new Error("Failed to update user");
  return res.json();
}

export async function updateUserPassword(userId: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/user/${userId}/password`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error("Failed to update password");
  return res.json();
}

export async function login(email: string, password: string, remember: boolean = false) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: await getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ email, password, remember }),
  });
  if (res.status === 401) return { error: "Invalid email or password" };
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    if (data.error === "account_blocked") return { error: "This account has been blocked." };
    if (data.error === "account_pending") return { error: "This account is awaiting admin approval." };
    if (data.error === "account_locked") return { error: "Too many failed attempts. Please try again later." };
    return { error: "Access denied." };
  }
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

export async function logout() {
  await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}