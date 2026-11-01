export interface User {
  id: string;
  username: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthMeResponse {
  id: string;
  username: string;
}
