"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    api,
    fetchProjects,
    createProject,
    archiveProject,
    restoreProject,
    deleteProject,
    type ProjectDto,
} from "@/lib/api";
import Link from "next/link";
import clsx from "clsx";
import {
    FolderOpen,
    Plus,
    Globe,
    MapPin,
    ExternalLink,
    Archive,
    RotateCcw,
    Trash2,
    Search,
    Filter,
    Grid3X3,
    List,
    Activity,
    ArchiveX,
    AlertCircle,
    CheckCircle2,
    Clock,
    Eye,
    BarChart3,
} from "lucide-react";

export default function ProjectsPage() {
    const qc = useQueryClient();
    const [tab, setTab] = useState<"active" | "archived">("active");
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // форма создания
    const [name, setName] = useState("");
    const [region, setRegion] = useState("");
    const [domain, setDomain] = useState("");
    const [err, setErr] = useState<string | null>(null);

    const projects = useQuery({
        queryKey: ["projects", tab],
        queryFn: () => fetchProjects({ archived: tab === "archived" }),
    });

    // Фильтрация проектов по поиску
    const filteredProjects = (projects.data || []).filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.domain?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Статистика
    const activeCount = useQuery({
        queryKey: ["projects", "active"],
        queryFn: () => fetchProjects({ archived: false }),
    });

    const archivedCount = useQuery({
        queryKey: ["projects", "archived"],
        queryFn: () => fetchProjects({ archived: true }),
    });

    const mCreate = useMutation({
        mutationFn: () => createProject({ name, region: region || undefined, domain: domain || undefined }),
        onSuccess: () => {
            setName(""); setRegion(""); setDomain(""); setErr(null);
            qc.invalidateQueries({ queryKey: ["projects"], exact: false });
        },
        onError: (e: any) => setErr(e?.response?.data?.detail || "Не удалось создать проект"),
    });

    const mArchive = useMutation({
        mutationFn: (id: string) => archiveProject(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
    });

    const mRestore = useMutation({
        mutationFn: (id: string) => restoreProject(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
    });

    const mDelete = useMutation({
        mutationFn: (id: string) => deleteProject(id, true),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
    });

    const ProjectCard = ({ project }: { project: ProjectDto }) => (
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-[var(--color-primary-hover)] text-white">
                        <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                        <Link
                            href={`/projects/${project.id}`}
                            className="text-lg font-semibold text-gray-900 hover:text-[var(--color-primary)] transition-colors"
                        >
                            {project.name}
                        </Link>
                        {project.domain && (
                            <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                                <Globe className="w-4 h-4" />
                                {project.domain}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-full ${tab === "active" ? "bg-green-500" : "bg-gray-400"}`} />
                    <span className="text-xs text-gray-500">
                        {tab === "active" ? "Активный" : "Архив"}
                    </span>
                </div>
            </div>

            {project.region && (
                <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>Регион: {project.region}</span>
                </div>
            )}

            <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                {tab === "active" ? (
                    <>
                        <Link
                            href={`/projects/${project.id}`}
                            className="flex items-center gap-2 px-4 py-2 text-[var(--color-primary)] bg-transparent border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:text-white transition-colors duration-300 ease-in-out rounded-xl text-sm font-medium"
                        >
                            <Eye className="w-4 h-4" />
                            Открыть
                        </Link>
                        <button
                            onClick={() => mArchive.mutate(project.id)}
                            className="flex items-center gap-2 px-4 py-2 btn-coffeeDark text-sm transition-colors duration-300 ease-in-out rounded-xl"
                        >
                            <Archive className="w-4 h-4" />
                            Архив
                        </button>
                        <button
                            onClick={() => {
                                if (confirm("Удалить проект безвозвратно?")) mDelete.mutate(project.id);
                            }}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-xl btn-pink transition-colors ml-auto"
                        >
                            <Trash2 className="w-4 h-4" />
                            Удалить
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => mRestore.mutate(project.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors duration-300 text-sm font-medium"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Восстановить
                        </button>
                        <button
                            onClick={() => {
                                if (confirm("Удалить проект безвозвратно?")) mDelete.mutate(project.id);
                            }}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-xl btn-pink transition-colors ml-auto"
                        >
                            <Trash2 className="w-4 h-4" />
                            Удалить
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    const ProjectListItem = ({ project }: { project: ProjectDto }) => (
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-md hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-[var(--color-primary-hover)] text-white">
                        <FolderOpen className="w-4 h-4" />
                    </div>
                    <div>
                        <Link
                            href={`/projects/${project.id}`}
                            className="font-medium text-gray-900 hover:text-[var(--color-primary)] transition-colors"
                        >
                            {project.name}
                        </Link>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            {project.domain && (
                                <div className="flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    {project.domain}
                                </div>
                            )}
                            {project.region && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {project.region}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${tab === "active" ? "bg-green-500" : "bg-gray-400"}`} />

                    {tab === "active" ? (
                        <>
                            <Link
                                href={`/projects/${project.id}`}
                                className="p-2 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors"
                                title="Открыть"
                            >
                                <Eye className="w-4 h-4" />
                            </Link>
                            <button
                                onClick={() => mArchive.mutate(project.id)}
                                className="p-2 text-[var(--color-coffee-text)] hover:bg-[var(--color-coffee)]/20 rounded-lg transition-colors"
                                title="Архивировать"
                            >
                                <Archive className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm("Удалить проект безвозвратно?")) mDelete.mutate(project.id);
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Удалить"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => mRestore.mutate(project.id)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Восстановить"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm("Удалить проект безвозвратно?")) mDelete.mutate(project.id);
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Удалить"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen from-gray-50 via-white to-blue-50/30">
            <div className="p-6 space-y-6">
                {/* Заголовок */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-[var(--color-primary-hover)] text-white">
                            <FolderOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text">
                                Проекты
                            </h1>
                            <p className="text-gray-500 mt-1">
                                Управление проектами и их настройками • Всего: {(activeCount.data?.length || 0) + (archivedCount.data?.length || 0)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Статистика */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Активные проекты</p>
                                <p className="text-2xl font-bold text-all mt-1">{activeCount.data?.length || 0}</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-base rounded-xl">
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">В архиве</p>
                                <p className="text-2xl font-bold text-all mt-1">{archivedCount.data?.length || 0}</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-blue rounded-xl">
                                <ArchiveX className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Всего проектов</p>
                                <p className="text-2xl font-bold text-all mt-1">
                                    {(activeCount.data?.length || 0) + (archivedCount.data?.length || 0)}
                                </p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-green rounded-xl">
                                <BarChart3 className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Форма создания проекта */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-xl bg-[var(--color-primary-hover)] text-white">
                            <Plus className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Создать новый проект</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative">
                            <FolderOpen className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                placeholder="Название проекта *"
                                className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                value={name}
                                onChange={e => { setName(e.target.value); setErr(null); }}
                            />
                        </div>

                        <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                placeholder="Регион"
                                className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                value={region}
                                onChange={e => setRegion(e.target.value)}
                            />
                        </div>

                        <div className="relative">
                            <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                placeholder="Домен"
                                className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                value={domain}
                                onChange={e => setDomain(e.target.value)}
                            />
                        </div>

                        <button
                            className="flex items-center justify-center gap-2 px-6 py-3 text-[var(--color-primary)] bg-transparent border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:text-white transition-colors duration-300 ease-in-out rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!name || mCreate.isPending}
                            onClick={() => mCreate.mutate()}
                        >
                            <Plus className="w-4 h-4" />
                            {mCreate.isPending ? "Создание..." : "Создать"}
                        </button>
                    </div>

                    {err && (
                        <div className="mt-4 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{err}</span>
                        </div>
                    )}
                </div>

                {/* Панель управления */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            {/* Табы */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setTab("active")}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                        tab === "active"
                                            ? "bg-green-600 text-white shadow-lg"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                                    }`}
                                >
                                    <Activity className="w-4 h-4" />
                                    Активные
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        tab === "active"
                                            ? "bg-white/20 text-white"
                                            : "bg-gray-200 text-gray-600"
                                    }`}>
                                        {activeCount.data?.length || 0}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setTab("archived")}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                        tab === "archived"
                                            ? "bg-[var(--color-coffee)] text-[var(--color-coffee-text)] shadow-lg"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                                    }`}
                                >
                                    <ArchiveX className="w-4 h-4" />
                                    Архив
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        tab === "archived"
                                            ? "bg-white/20"
                                            : "bg-gray-200 text-gray-600"
                                    }`}>
                                        {archivedCount.data?.length || 0}
                                    </span>
                                </button>
                            </div>

                            {/* Поиск */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    placeholder="Поиск проектов..."
                                    className="pl-10 pr-4 py-2.5 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Переключатель вида */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`p-2.5 rounded-xl transition-all duration-200 ${
                                    viewMode === "grid"
                                        ? "bg-[var(--color-primary)] text-white"
                                        : "text-gray-600 hover:bg-gray-100"
                                }`}
                                title="Сетка"
                            >
                                <Grid3X3 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-2.5 rounded-xl transition-all duration-200 ${
                                    viewMode === "list"
                                        ? "bg-[var(--color-primary)] text-white"
                                        : "text-gray-600 hover:bg-gray-100"
                                }`}
                                title="Список"
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Список проектов */}
                {filteredProjects.length > 0 ? (
                    <div className={
                        viewMode === "grid"
                            ? "grid grid-cols-1 md:grid-cols-2 gap-6"
                            : "space-y-4"
                    }>
                        {filteredProjects.map((project: ProjectDto) =>
                            viewMode === "grid" ? (
                                <ProjectCard key={project.id} project={project} />
                            ) : (
                                <ProjectListItem key={project.id} project={project} />
                            )
                        )}
                    </div>
                ) : (
                    <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-12 border border-white/20 shadow-xl text-center">
                        <div className="w-16 h-16 bg-[var(--color-coffee)]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FolderOpen className="w-8 h-8 text-[var(--color-coffee-text)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {searchTerm ? "Проекты не найдены" : `Нет ${tab === "active" ? "активных" : "архивных"} проектов`}
                        </h3>
                        <p className="text-gray-500">
                            {searchTerm
                                ? `Попробуйте изменить поисковый запрос "${searchTerm}"`
                                : `${tab === "active" ? "Создайте первый проект" : "Все проекты находятся в активном состоянии"}`
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}