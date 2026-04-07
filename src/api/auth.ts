import { apiClient } from "@/api/client";
import type { CurrentUser, LoginResponse } from "@/types";

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  // fastapi-users uses x-www-form-urlencoded for the JWT login endpoint
  // (OAuth2PasswordRequestForm under the hood). The "username" field is
  // the email address.
  const params = new URLSearchParams();
  params.append("username", email);
  params.append("password", password);

  const response = await apiClient.post<LoginResponse>(
    "/auth/jwt/login",
    params,
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );
  return response.data;
}

export async function fetchMe(): Promise<CurrentUser> {
  const response = await apiClient.get<CurrentUser>("/users/me");
  return response.data;
}
