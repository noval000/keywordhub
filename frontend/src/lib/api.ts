// src/lib/api.ts
import axios from "axios";
import { useAuthStore } from "@/store/auth";

/** ---------- Base axios with auth (как раньше) ---------- */
export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
});

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (r) => r,
    (err) => {
        if (err?.response?.status === 401) {
            // сбрасываем токен и уводим на /login
            useAuthStore.getState().logout();
            if (typeof window !== "undefined") window.location.href = "/login";
        }
        return Promise.reject(err);
    }
);

/* ---------------- Auth ---------------- */
export async function login(email: string, password: string) {
    const r = await api.post("/auth/login", { email, password });
    return r.data as { access_token: string; token_type: "bearer" };
}

/* ---------------- Projects ---------------- */

export type ProjectDto = {
    id: string;
    name: string;
    region?: string | null;
    domain?: string | null;
    is_archived: boolean;
    archived_at?: string | null;
};

export async function fetchProject(id: string): Promise<ProjectDto> {
    const r = await api.get(`/projects/${id}`);
    return r.data;
}

export async function fetchProjects(opts: { archived: boolean }): Promise<ProjectDto[]> {
    const r = await api.get<ProjectDto[]>("/projects", {
        params: { archived: opts.archived },
    });
    return r.data;
}

export async function createProject(payload: {
    name: string;
    region?: string | null;
    domain?: string | null;
}): Promise<ProjectDto> {
    const r = await api.post("/projects", payload);
    return r.data;
}

export async function updateProject(
    id: string,
    payload: { name?: string; region?: string; domain?: string; is_archived?: boolean }
): Promise<ProjectDto> {
    const r = await api.patch(`/projects/${id}`, payload);
    return r.data;
}

export async function archiveProject(id: string): Promise<ProjectDto> {
    try {
        const r = await api.post(`/projects/${id}/archive`);
        return r.data;
    } catch {
        const r = await api.patch(`/projects/${id}`, { is_archived: true });
        return r.data;
    }
}

export async function restoreProject(id: string): Promise<ProjectDto> {
    try {
        const r = await api.post(`/projects/${id}/restore`);
        return r.data;
    } catch {
        const r = await api.patch(`/projects/${id}`, { is_archived: false });
        return r.data;
    }
}

export async function deleteProject(id: string, hard = false) {
    try {
        const r = await api.delete(`/projects/${id}`, { params: { hard } });
        return r.data;
    } catch {
        const r = await api.patch(`/projects/${id}`, { is_archived: true });
        return r.data;
    }
}

/* ---------------- Global Delete (queries) ---------------- */

export type GlobalDeleteFilters = {
    phrase_contains?: string;
    page_contains?: string;
    tag_contains?: string;
    direction_contains?: string;
    cluster_contains?: string;
    ws_min?: number;
    ws_max?: number;
    date_from?: string;
    date_to?: string;
};

export type GlobalDeletePreviewRow = {
    project_id: string;
    project_name: string;
    count: number;
};

export type GlobalDeletePreview = {
    total: number;
    per_project: GlobalDeletePreviewRow[];
};

export async function globalDeletePreview(filters: GlobalDeleteFilters) {
    const r = await api.post<GlobalDeletePreview>("/queries/global-delete/preview", filters);
    return r.data;
}

export async function globalDeleteApply(args: {
    project_ids: string[];
    filters: GlobalDeleteFilters;
    confirm: string; // должно быть "DELETE"
}) {
    const r = await api.post("/queries/global-delete/apply", args);
    return r.data;
}

/* ---------------- Cluster Registry ---------------- */

export async function listClusterRegistry(project_id: string) {
    const r = await api.get("/cluster-registry", { params: { project_id } });
    return r.data as Array<{
        id: string;
        project_id: string;
        name: string;
        direction?: string;
        page_type?: string;
        has_core: boolean;
        has_brief: boolean;
        is_published: boolean;
        demand: number;
    }>;
}

export async function upsertClusterRegistryRow(row: {
    project_id: string;
    name: string;
    direction?: string;
    page_type?: string;
    has_core?: boolean;
    has_brief?: boolean;
    is_published?: boolean;
    demand?: number;
}) {
    const r = await api.post("/cluster-registry", row);
    return r.data;
}

export async function updateClusterRegistryRow(
    id: string,
    patch: Partial<{
        direction: string;
        page_type: string;
        has_core: boolean;
        has_brief: boolean;
        is_published: boolean;
        demand: number;
    }>
) {
    const r = await api.patch(`/cluster-registry/${id}`, patch);
    return r.data;
}

export async function deleteClusterRegistryRow(id: string) {
    const r = await api.delete(`/cluster-registry/${id}`);
    return r.data;
}

export async function bulkClusterRegistry(project_id: string, rows: any[]) {
    const r = await api.post("/cluster-registry/bulk", { project_id, rows });
    return r.data;
}

/* ---------------- Queries: import-multi (оставляем как было) ---------------- */

export function importQueriesMulti(payload: {
    project_ids: string[];
    default_direction?: string;
    default_cluster?: string;
    default_query_type?: string;
    items: Array<{
        phrase: string;
        direction?: string;
        cluster?: string;
        page?: string;
        tags?: string[];
        page_type?: string;
        query_type?: string;
        ws_flag?: number;
        date?: string;
    }>;
}) {
    // Возвращаем полный AxiosResponse, чтобы снаружи можно было смотреть статус-код (207 и т.д.)
    return api.post("/queries/import-multi", payload);
}

export type ImportMultiResponse = {
    created: number;
    updated: number;
    skipped: number;
};

/* ====== CONTENT PLAN (без publish_allowed) ====== */

export type CPItem = {
    id: string;
    project_id: string | null;
    period: string | null;
    section: string | null;
    direction: string | null;
    topic: string | null;
    tz: string | null;
    chars: number | null;
    status: string | null;
    author: string | null;
    reviewing_doctor: string | null;
    doctor_approved: boolean | null;
    review: string | null;      // ссылка "на проверке у врача"
    meta_seo: string | null;
    doctor_review?: boolean | null;
    comment: string | null;
    link: string | null;
    publish_date: string | null;
    created_at?: string;
    updated_at?: string;
    version?: number;
};

export async function cpList(opts: {
    search?: string;
    status?: string;
    period?: string;
    author?: string;
    reviewing_doctor?: string;
    limit?: number;
    offset?: number;
}): Promise<CPItem[]> {
    const r = await api.get<CPItem[]>("/content-plan", {
        params: {
            search: opts.search,
            status: opts.status,
            period: opts.period,
            author: opts.author,
            reviewing_doctor: opts.reviewing_doctor,
            limit: opts.limit ?? 50,
            offset: opts.offset ?? 0,
        },
    });
    return r.data;
}

export async function cpCount(opts: {
    search?: string;
    status?: string;
    period?: string;
    author?: string;
    reviewing_doctor?: string;
}): Promise<number> {
    const r = await api.get<{ total: number }>("/content-plan/count", {
        params: {
            search: opts.search,
            status: opts.status,
            period: opts.period,
            author: opts.author,
            reviewing_doctor: opts.reviewing_doctor,
        },
    });
    return r.data.total;
}

export async function cpCreate(payload: {
    project_ids: string[];
    item: Partial<CPItem>;
}): Promise<CPItem[]> {
    const r = await api.post<CPItem[]>("/content-plan", payload);
    return r.data;
}

export async function cpUpdate(id: string, item: Partial<CPItem>): Promise<CPItem> {
    const r = await api.patch<CPItem>(`/content-plan/${id}`, { item });
    return r.data;
}

export async function cpDelete(ids: string[]): Promise<{ deleted: number }> {
    const r = await api.delete<{ deleted: number }>("/content-plan", { data: ids });
    return r.data;
}

export async function cpImport(items: Array<Partial<CPItem> & { project_id: string }>): Promise<{ created: number; duplicates: number }> {
    const r = await api.post<{ created: number; duplicates: number }>("/content-plan/import", { items });
    return r.data;
}

// --- Project members API (admin only) ---

export type ProjectMemberDto = {
    user_id: string;
    role: "viewer" | "editor" | "admin";
    email: string;
    name: string | null;
};

export type UserWithAccessDto = ProjectMemberDto & {
    pages?: string[]; // новые права на страницы
};

// список участников (только роли)
export async function listProjectMembers(projectId: string): Promise<ProjectMemberDto[]> {
    const r = await api.get(`/projects/${projectId}/members`);
    return r.data;
}

// список участников с доступом к страницам
export async function listProjectMembersWithAccess(projectId: string): Promise<UserWithAccessDto[]> {
    const r = await api.get(`/projects/${projectId}/members-with-access`);
    return r.data;
}

export async function addProjectMember(
    projectId: string,
    payload: { user_id: string; role: "viewer" | "editor" | "admin" }
) {
    const r = await api.post(`/projects/${projectId}/members`, payload);
    return r.data as { ok: boolean; created?: boolean; updated?: boolean };
}

export async function removeProjectMember(projectId: string, userId: string) {
    const r = await api.delete(`/projects/${projectId}/members/${userId}`);
    return r.data as { ok: boolean; deleted?: boolean };
}

export async function grantLikeUser(from_user_id: string, to_user_id: string) {
    const r = await api.post(`/projects/admin/grant-like-user`, { from_user_id, to_user_id });
    return r.data as { ok: boolean; granted: number };
}

// обновление роли и страниц участника
export async function updateMemberAccess(
    projectId: string,
    userId: string,
    payload: {
        role?: "viewer" | "editor" | "admin";
        pages_grant?: string[];
        pages_revoke?: string[];
    }
) {
    const r = await api.patch(`/projects/${projectId}/members/${userId}`, payload);
    return r.data as { ok: boolean };
}

// Получить всех пользователей (только для суперюзера)
export type UserDto = {
    id: string;
    email: string;
    name: string | null;
    is_active: boolean;
    is_superuser: boolean;
    can_view_all_content?: boolean; // настройка для кп (видимость всех поей или только своих)
};



export async function listUsers(): Promise<UserDto[]> {
    const r = await api.get<UserDto[]>("/auth/users");
    return r.data;
}

export async function listAuthors(): Promise<UserDto[]> {
    const r = await api.get<UserDto[]>("/auth/users/authors");
    return r.data;
}

export const updateUserContentAccess = async (userId: string, canViewAllContent: boolean) => {
    return api.patch(`/auth/users/${userId}/content-access`, {
        can_view_all_content: canViewAllContent  // ИСПРАВЛЕНО: передаем объект, а не просто boolean
    });
};

export const getAnalytics = async (projectId?: string) => {
    const params = projectId ? { project_id: projectId } : {};
    return api.get('/analytics/report', { params });
};