// A1 – đăng nhập (docs/api-contract.md).
import { http, setSession, clearSession } from './client.js';

export async function login(username, password) {
  const result = await http.post('/auth/login', { username, password });
  setSession({ token: result.token, staff: result.staff });
  return result.staff;
}

export function logout() {
  clearSession();
}
