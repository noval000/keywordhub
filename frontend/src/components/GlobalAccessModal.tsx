"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listUsers, fetchProjects, addProjectMember, removeProjectMember } from "@/lib/api";
import { useModal } from "@/app/providers/modal";
import { api } from "@/lib/api";

const PAGES = ["clusters", "content_plan"];

interface PageRole {
    page: string;
    role: string;
}

interface PageRoleUpdate {
    page: string;
    role: string;
}

export default function GlobalAccessModal() {
    const { close } = useModal();

    const { data: users = [], isLoading: usersLoading } = useQuery({
        queryKey: ["users"],
        queryFn: listUsers,
    });
    const { data: projects = [], isLoading: projectsLoading } = useQuery({
        queryKey: ["projects"],
        queryFn: () => fetchProjects({ archived: false }),
    });

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const selectedUser = users.find(u => u.id === selectedUserId);

    // Состояния для проектов и страниц
    const [userProjectRoles, setUserProjectRoles] = useState<Record<string, string>>({});
    const [userPages, setUserPages] = useState<Set<string>>(new Set());
    const [userPageRoles, setUserPageRoles] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'projects' | 'pages'>('projects');

    useEffect(() => {
        if (!selectedUserId) {
            setUserProjectRoles({});
            setUserPages(new Set());
            setUserPageRoles({});
            return;
        }

        setLoading(true);
        setError(null);
        Promise.all([
            api.get(`/projects/user-memberships`, { params: { user_id: selectedUserId } }),
            api.get(`/access/pages`, { params: { user_id: selectedUserId } }),
        ])
            .then(([projRes, pageRes]) => {
                // Сохраняем роли для каждого проекта отдельно
                const projectRoles: Record<string, string> = {};
                (projRes.data || []).forEach((pm: any) => {
                    projectRoles[pm.project_id] = pm.role;
                });
                setUserProjectRoles(projectRoles);

                // Сохраняем страницы и их роли
                const pages = new Set(pageRes.data.pages || []);
                setUserPages(pages);

                // Сохраняем роли для страниц
                const pageRoles: Record<string, string> = {};
                if (pageRes.data.page_roles) {
                    pageRes.data.page_roles.forEach((pr: PageRole) => {
                        pageRoles[pr.page] = pr.role;
                    });
                }
                // Устанавливаем роли по умолчанию для страниц без роли
                pages.forEach(page => {
                    if (!pageRoles[page]) {
                        pageRoles[page] = "viewer";
                    }
                });
                setUserPageRoles(pageRoles);
            })
            .catch(e => {
                console.error("Ошибка загрузки данных пользователя:", e);
                setError(e?.response?.data?.detail || "Ошибка запроса");
            })
            .finally(() => setLoading(false));
    }, [selectedUserId]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!selectedUserId) return;

            try {
                // Обновляем каждый проект с его индивидуальной ролью
                const projectUpdates = projects.map(async (p) => {
                    const currentRole = userProjectRoles[p.id];

                    if (currentRole) {
                        // Пользователь должен быть в проекте - добавляем/обновляем
                        try {
                            return await addProjectMember(p.id, {
                                user_id: selectedUserId,
                                role: currentRole
                            });
                        } catch (error: any) {
                            // Игнорируем ошибку, если пользователь уже есть с такой же ролью
                            if (error?.response?.status === 400 &&
                                error?.response?.data?.detail?.includes("обновлена")) {
                                return;
                            }
                            if (error?.response?.status !== 409) { // 409 - conflict, пользователь уже есть
                                throw error;
                            }
                        }
                    } else {
                        // Пользователя не должно быть в проекте - удаляем
                        try {
                            return await removeProjectMember(p.id, selectedUserId);
                        } catch (error: any) {
                            // Игнорируем ошибку 404 (пользователь уже не в проекте)
                            if (error?.response?.status !== 404) {
                                throw error;
                            }
                        }
                    }
                });

                await Promise.all(projectUpdates.filter(Boolean));

                // Обновляем страницы и их роли
                const currentPages = Array.from(userPages);
                const pagesToRevoke = PAGES.filter(p => !userPages.has(p));

                // Формируем роли для страниц
                const pageRoles: PageRoleUpdate[] = currentPages.map(page => ({
                    page,
                    role: userPageRoles[page] || "viewer"
                }));

                if (currentPages.length > 0 || pagesToRevoke.length > 0) {
                    await api.post(`/access/pages/${selectedUserId}/update`, {
                        pages_grant: currentPages,
                        pages_revoke: pagesToRevoke,
                        page_roles: pageRoles,
                    });
                }
            } catch (error) {
                console.error("Ошибка при сохранении:", error);
                throw error;
            }
        },
        onError: (e: any) => {
            console.error('Ошибка сохранения:', e);
            setError(e?.response?.data?.detail || e?.message || "Ошибка сохранения");
        },
        onSuccess: () => {
            close();
        },
    });

    // Функция для переключения проекта
    const toggleProject = (projectId: string) => {
        setUserProjectRoles(prev => {
            const newRoles = { ...prev };
            if (newRoles[projectId]) {
                // Удаляем проект
                delete newRoles[projectId];
            } else {
                // Добавляем проект с ролью по умолчанию
                newRoles[projectId] = "viewer";
            }
            return newRoles;
        });
    };

    // Функция для изменения роли в конкретном проекте
    const updateProjectRole = (projectId: string, role: string) => {
        setUserProjectRoles(prev => ({
            ...prev,
            [projectId]: role
        }));
    };

    // Функция для переключения страницы
    const togglePage = (page: string) => {
        setUserPages(prev => {
            const copy = new Set(prev);
            if (copy.has(page)) {
                copy.delete(page);
                // Удаляем роль при отключении страницы
                setUserPageRoles(prevRoles => {
                    const newRoles = { ...prevRoles };
                    delete newRoles[page];
                    return newRoles;
                });
            } else {
                copy.add(page);
                // Добавляем роль по умолчанию при включении страницы
                setUserPageRoles(prevRoles => ({
                    ...prevRoles,
                    [page]: "viewer"
                }));
            }
            return copy;
        });
    };

    // Функция для изменения роли страницы
    const updatePageRole = (page: string, role: string) => {
        setUserPageRoles(prev => ({
            ...prev,
            [page]: role
        }));
    };

    // Подсчет активных доступов
    const activeProjectsCount = Object.keys(userProjectRoles).length;
    const activePagesCount = userPages.size;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 relative animate-fade-in flex flex-col">
                {/* Заголовок - фиксированный */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Управление доступами</h2>
                                <p className="text-indigo-100 mt-1">Настройка прав пользователей для проектов и разделов</p>
                            </div>
                        </div>
                        {/* Кнопка закрытия */}
                        <button
                            onClick={close}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Основной контент - скролящийся */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-8">
                        {error && (
                            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <div>
                                        <div className="font-medium text-red-800">Произошла ошибка</div>
                                        <div className="text-red-700 text-sm mt-1">{error}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Выбор пользователя */}
                        <div className="mb-8">
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                Выберите пользователя
                            </label>
                            <div className="relative">
                                <select
                                    className="w-full border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-3 text-base bg-white transition-all appearance-none pr-10"
                                    value={selectedUserId || ""}
                                    onChange={e => setSelectedUserId(e.target.value)}
                                    disabled={loading || saveMutation.isPending}
                                >
                                    <option value="">Выберите пользователя...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.name ? `${u.name} (${u.email})` : u.email}
                                            {u.is_superuser && " 👑"}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {selectedUserId && selectedUser && (
                            <div className="mb-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                                        {selectedUser.name ? selectedUser.name[0].toUpperCase() : selectedUser.email[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-800">
                                            {selectedUser.name || selectedUser.email}
                                            {selectedUser.is_superuser && <span className="ml-2 text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">👑 Суперпользователь</span>}
                                        </div>
                                        <div className="text-sm text-slate-600">{selectedUser.email}</div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            Активно: {activeProjectsCount} проектов • {activePagesCount} разделов
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedUserId && !loading && (
                            <>
                                {/* Табы */}
                                <div className="mb-6">
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button
                                            onClick={() => setActiveTab('projects')}
                                            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                                                activeTab === 'projects'
                                                    ? 'bg-white text-slate-900 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                            Проекты
                                            {activeProjectsCount > 0 && (
                                                <span className="bg-indigo-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                                                    {activeProjectsCount}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('pages')}
                                            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                                                activeTab === 'pages'
                                                    ? 'bg-white text-slate-900 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Разделы
                                            {activePagesCount > 0 && (
                                                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                                                    {activePagesCount}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Контент табов */}
                                <div className="pb-6">
                                    {activeTab === 'projects' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-semibold text-slate-800">Доступ к проектам</h3>
                                                <div className="text-sm text-slate-500">
                                                    {projects.length} доступных проектов
                                                </div>
                                            </div>

                                            <div className="grid gap-3">
                                                {projects.map(p => (
                                                    <div
                                                        key={p.id}
                                                        className={`group p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                                                            userProjectRoles[p.id]
                                                                ? 'border-indigo-200 bg-indigo-50/50'
                                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <label className="flex items-center gap-4 flex-1 cursor-pointer">
                                                                <div className="relative">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-5 h-5 accent-indigo-600 rounded"
                                                                        checked={!!userProjectRoles[p.id]}
                                                                        onChange={() => toggleProject(p.id)}
                                                                    />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-semibold text-slate-800 truncate">{p.name}</div>
                                                                    {p.region && (
                                                                        <div className="text-sm text-slate-500">{p.region}</div>
                                                                    )}
                                                                    {p.domain && (
                                                                        <div className="text-xs text-slate-400">{p.domain}</div>
                                                                    )}
                                                                </div>
                                                            </label>
                                                            {userProjectRoles[p.id] && (
                                                                <div className="flex items-center gap-3">
                                                                    <select
                                                                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[120px]"
                                                                        value={userProjectRoles[p.id]}
                                                                        onChange={e => updateProjectRole(p.id, e.target.value)}
                                                                    >
                                                                        <option value="viewer">👁️ Viewer</option>
                                                                        <option value="editor">✏️ Editor</option>
                                                                    </select>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {projects.length === 0 && (
                                                <div className="text-center py-12 text-slate-400">
                                                    <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                    </svg>
                                                    <div className="text-lg font-medium mb-1">Нет доступных проектов</div>
                                                    <div className="text-sm">Проекты появятся здесь, когда они будут созданы</div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'pages' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-semibold text-slate-800">Доступ к разделам</h3>
                                                <div className="text-sm text-slate-500">
                                                    {PAGES.length} доступных разделов
                                                </div>
                                            </div>

                                            <div className="grid gap-4">
                                                {PAGES.map(page => (
                                                    <div
                                                        key={page}
                                                        className={`group p-6 rounded-xl border-2 transition-all hover:shadow-md ${
                                                            userPages.has(page)
                                                                ? 'border-green-200 bg-green-50/50'
                                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <label className="flex items-center gap-4 flex-1 cursor-pointer">
                                                                <div className="relative">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-5 h-5 accent-green-600 rounded"
                                                                        checked={userPages.has(page)}
                                                                        onChange={() => togglePage(page)}
                                                                    />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-3 mb-2">
                                                                        <div className="text-2xl">
                                                                            {page === "clusters" ? "📊" : "📝"}
                                                                        </div>
                                                                        <div>
                                                                            <div className="font-semibold text-slate-800 text-lg">
                                                                                {page === "clusters" ? "Реестр кластеров" : "Контент-план"}
                                                                            </div>
                                                                            <div className="text-sm text-slate-600">
                                                                                {page === "clusters"
                                                                                    ? "Управление кластерами, направлениями и структурой данных"
                                                                                    : "Планирование, создание и управление контентом проектов"
                                                                                }
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </label>
                                                            {userPages.has(page) && (
                                                                <div className="flex items-center gap-3">
                                                                    <select
                                                                        className="border border-slate-300 rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 min-w-[140px]"
                                                                        value={userPageRoles[page] || "viewer"}
                                                                        onChange={e => updatePageRole(page, e.target.value)}
                                                                    >
                                                                        <option value="viewer">👁️ Только просмотр</option>
                                                                        <option value="editor">✏️ Полные права</option>
                                                                    </select>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                                <div className="flex items-start gap-3">
                                                    <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                    </svg>
                                                    <div className="text-sm">
                                                        <div className="font-medium text-blue-800 mb-1">Информация о ролях:</div>
                                                        <div className="text-blue-700 space-y-1">
                                                            <div><strong>👁️ Только просмотр:</strong> Пользователь может видеть данные, но не может их изменять</div>
                                                            <div><strong>✏️ Полные права:</strong> Пользователь может создавать, редактировать и удалять данные</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Нижняя панель с кнопками - фиксированная */}
                <div className="border-t border-slate-200 px-8 py-6 bg-slate-50 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-600">
                            {selectedUserId && selectedUser ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    Настраиваются права для: <strong>{selectedUser.name || selectedUser.email}</strong>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                    Пользователь не выбран
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                className="px-6 py-3 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium transition-all disabled:opacity-50"
                                onClick={close}
                                type="button"
                                disabled={saveMutation.isPending}
                            >
                                Отмена
                            </button>
                            <button
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 font-semibold shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 min-w-[140px] justify-center"
                                onClick={() => saveMutation.mutate()}
                                disabled={saveMutation.isPending || !selectedUserId}
                                type="button"
                            >
                                {saveMutation.isPending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Сохраняем...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Сохранить
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Лоадер */}
                {loading && (
                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-3xl backdrop-blur-sm z-10">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                                <div className="w-12 h-12 border-4 border-indigo-200 rounded-full"></div>
                                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                            </div>
                            <div className="text-slate-700 font-medium">Загружаем данные пользователя...</div>
                        </div>
                    </div>
                )}

                <style jsx>{`
                    .animate-fade-in { 
                        animation: fadeIn 0.4s ease-out;
                    }
                    @keyframes fadeIn {
                        from { 
                            opacity: 0; 
                            transform: scale(0.96) translateY(-20px);
                        }
                        to { 
                            opacity: 1; 
                            transform: scale(1) translateY(0);
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}