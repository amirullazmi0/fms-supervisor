export interface User {
    id: string;
    email: string;
    name: string | null;
    role_id: string;
    role: string;
    is_administrator: boolean; // superuser: passes every permission check
    admin_app: boolean; // may open fms-administrator
    permissions?: string[];
    is_active: boolean;
    last_login_at: number | null;
    created_at: number;
    updated_at: number;
}

export interface AuthResponse {
    user: User;
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

export interface LoginRequest {
    email: string;
    password: string;
}
