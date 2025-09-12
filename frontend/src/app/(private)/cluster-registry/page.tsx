"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listClusterRegistry, upsertClusterRegistryRow, updateClusterRegistryRow,
    deleteClusterRegistryRow, fetchProjects
} from "@/lib/api";
import { api } from "@/lib/api";
import Select from "@/components/ui/Select";
import {
    Search,
    Filter,
    RotateCcw,
    Upload,
    Plus,
    Trash2,
    Database,
    BarChart3,
    CheckSquare,
    Square,
    FileText,
    Target,
    Globe,
    Download,
    Eye,
    Settings,
    AlertTriangle,
    Info,
    Edit,
    Save,
    X,
    Hash,
    Tag,
    Globe2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from "lucide-react";

// Модалка редактирования кластера (такая же как была)
function ClusterEditModal({
                              open,
                              cluster,
                              onClose,
                              onSaved
                          }: {
    open: boolean;
    cluster: any | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "",
        direction: "",
        page_type: "",
        has_core: false,
        has_brief: false,
        is_published: false,
        demand: 0
    });

    useEffect(() => {
        if (!open || !cluster) return;
        setError(null);
        setForm({
            name: cluster.name || "",
            direction: cluster.direction || "",
            page_type: cluster.page_type || "",
            has_core: cluster.has_core || false,
            has_brief: cluster.has_brief || false,
            is_published: cluster.is_published || false,
            demand: cluster.demand || 0
        });
    }, [open, cluster]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const setField = (field: string, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const onSubmit = async () => {
        if (!cluster) return;
        setPending(true);
        setError(null);
        try {
            const cleanData = {
                direction: form.direction?.trim() || null,
                page_type: form.page_type?.trim() || null,
                has_core: form.has_core,
                has_brief: form.has_brief,
                is_published: form.is_published,
                demand: Number(form.demand) || 0
            };

            await updateClusterRegistryRow(cluster.id, cleanData);
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e?.message || "Не удалось сохранить изменения");
        } finally {
            setPending(false);
        }
    };

    if (!open || !cluster) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-rose rounded-3xl shadow-2xl w-[600px] max-w-[95vw] max-h-[90vh] overflow-hidden border border-white/20">
                {/* Заголовок */}
                <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-100 flex items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-[var(--color-primary-hover)] text-white">
                            <Edit className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Редактировать кластер</h2>
                    </div>
                    <button
                        className="ml-auto p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Содержимое */}
                <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
                    {/* Ошибка */}
                    {error && (
                        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Основные поля */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Database className="w-5 h-5 text-[var(--color-primary)]" />
                            Информация о кластере
                        </h3>

                        <div className="space-y-4">
                            {/* Название кластера (readonly) */}
                            <div className="relative">
                                <Hash className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <div className="w-full pl-12 pr-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-gray-700 font-medium">
                                    {cluster.name}
                                </div>
                                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                                    Название не редактируется
                                </span>
                            </div>

                            {/* Направление */}
                            <div className="relative">
                                <Target className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    placeholder="Направление кластера"
                                    value={form.direction}
                                    onChange={(e) => setField("direction", e.target.value)}
                                />
                            </div>

                            {/* Тип страницы */}
                            <div className="relative">
                                <Tag className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    placeholder="Тип страницы"
                                    value={form.page_type}
                                    onChange={(e) => setField("page_type", e.target.value)}
                                />
                            </div>

                            {/* Спрос */}
                            <div className="relative">
                                <BarChart3 className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    placeholder="Уровень спроса"
                                    value={form.demand}
                                    onChange={(e) => setField("demand", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Статусы */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                            <Settings className="w-5 h-5 text-[var(--color-primary)]" />
                            Статусы и флаги
                        </h3>

                        <div className="space-y-4">
                            {/* Ядро */}
                            <label className="flex items-center gap-3 bg-blue-50 rounded-xl p-3 cursor-pointer hover:bg-blue-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={form.has_core}
                                    onChange={(e) => setField("has_core", e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded border-2 transition-colors ${
                                    form.has_core
                                        ? 'bg-[var(--color-primary-hover)] border-[var(--color-primary-hover)]'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}>
                                    {form.has_core && <CheckSquare className="w-5 h-5 text-white"/>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Target className="w-5 h-5 text-blue-600"/>
                                    <span className="text-sm font-medium text-blue-700">Ядро</span>
                                </div>
                            </label>

                            {/* ТЗ */}
                            <label className="flex items-center gap-3 bg-purple-50 rounded-xl p-3 cursor-pointer hover:bg-purple-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={form.has_brief}
                                    onChange={(e) => setField("has_brief", e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded border-2 transition-colors ${
                                    form.has_brief
                                        ? 'bg-purple-600 border-purple-600'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}>
                                    {form.has_brief && <CheckSquare className="w-5 h-5 text-white"/>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-purple-600"/>
                                    <span className="text-sm font-medium text-purple-700">Есть техническое задание</span>
                                </div>
                            </label>

                            {/* Размещено */}
                            <label className="flex items-center gap-3 bg-green-50 rounded-xl p-3 cursor-pointer hover:bg-green-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={form.is_published}
                                    onChange={(e) => setField("is_published", e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded border-2 transition-colors ${
                                    form.is_published
                                        ? 'bg-green-600 border-green-600'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}>
                                    {form.is_published && <CheckSquare className="w-5 h-5 text-white"/>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-green-600"/>
                                    <span className="text-sm font-medium text-green-700">Размещено на сайте</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Футер */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button
                        className="btn-coffeeDark text-sm transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2"
                        onClick={onClose}
                        disabled={pending}
                    >
                        Отмена
                    </button>
                    <button
                        className="flex items-center gap-2 text-[var(--color-primary)] text-sm bg-transparent border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:text-white transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={pending}
                        onClick={onSubmit}
                    >
                        <Save className="w-4 h-4" />
                        {pending ? "Сохранение..." : "Сохранить"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Модалка добавления кластера
function ClusterAddModal({
                             open,
                             projectId,
                             onClose,
                             onSaved
                         }: {
    open: boolean;
    projectId: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "",
        direction: "",
        page_type: "",
        has_core: false,
        has_brief: false,
        is_published: false,
        demand: 0
    });

    useEffect(() => {
        if (!open) return;
        setError(null);
        setForm({
            name: "",
            direction: "",
            page_type: "",
            has_core: false,
            has_brief: false,
            is_published: false,
            demand: 0
        });
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const setField = (field: string, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const onSubmit = async () => {
        if (!form.name.trim()) {
            setError("Название кластера обязательно для заполнения");
            return;
        }

        setPending(true);
        setError(null);
        try {
            const cleanData = {
                name: form.name.trim(),
                direction: form.direction?.trim() || null,
                page_type: form.page_type?.trim() || null,
                has_core: form.has_core,
                has_brief: form.has_brief,
                is_published: form.is_published,
                demand: Number(form.demand) || 0,
                project_id: projectId
            };

            await upsertClusterRegistryRow(cleanData);
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e?.message || "Не удалось создать кластер");
        } finally {
            setPending(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-rose rounded-3xl shadow-2xl w-[600px] max-w-[95vw] max-h-[90vh] overflow-hidden border border-white/20">
                {/* Заголовок */}
                <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-100 flex items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-[var(--color-primary-hover)] text-white">
                            <Plus className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Добавить новый кластер</h2>
                    </div>
                    <button
                        className="ml-auto p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Содержимое */}
                <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
                    {/* Ошибка */}
                    {error && (
                        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Основные поля */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Database className="w-5 h-5 text-[var(--color-primary)]" />
                            Информация о кластере
                        </h3>

                        <div className="space-y-4">
                            {/* Название кластера */}
                            <div className="relative">
                                <Hash className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    placeholder="Название кластера *"
                                    value={form.name}
                                    onChange={(e) => setField("name", e.target.value)}
                                />
                            </div>

                            {/* Направление */}
                            <div className="relative">
                                <Target className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    placeholder="Направление кластера"
                                    value={form.direction}
                                    onChange={(e) => setField("direction", e.target.value)}
                                />
                            </div>

                            {/* Тип страницы */}
                            <div className="relative">
                                <Tag className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    placeholder="Тип страницы"
                                    value={form.page_type}
                                    onChange={(e) => setField("page_type", e.target.value)}
                                />
                            </div>

                            {/* Спрос */}
                            <div className="relative">
                                <BarChart3 className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    placeholder="Уровень спроса"
                                    value={form.demand}
                                    onChange={(e) => setField("demand", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Статусы */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                            <Settings className="w-5 h-5 text-[var(--color-primary)]" />
                            Статусы и флаги
                        </h3>

                        <div className="space-y-4">
                            {/* Ядро */}
                            <label className="flex items-center gap-3 bg-blue-50 rounded-xl p-3 cursor-pointer hover:bg-blue-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={form.has_core}
                                    onChange={(e) => setField("has_core", e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded border-2 transition-colors ${
                                    form.has_core
                                        ? 'bg-[var(--color-primary-hover)] border-[var(--color-primary-hover)]'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}>
                                    {form.has_core && <CheckSquare className="w-5 h-5 text-white"/>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Target className="w-5 h-5 text-blue-600"/>
                                    <span className="text-sm font-medium text-blue-700">Есть ядро</span>
                                </div>
                            </label>

                            {/* ТЗ */}
                            <label className="flex items-center gap-3 bg-purple-50 rounded-xl p-3 cursor-pointer hover:bg-purple-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={form.has_brief}
                                    onChange={(e) => setField("has_brief", e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded border-2 transition-colors ${
                                    form.has_brief
                                        ? 'bg-purple-600 border-purple-600'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}>
                                    {form.has_brief && <CheckSquare className="w-5 h-5 text-white"/>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-purple-600"/>
                                    <span className="text-sm font-medium text-purple-700">Есть техническое задание</span>
                                </div>
                            </label>

                            {/* Размещено */}
                            <label className="flex items-center gap-3 bg-green-50 rounded-xl p-3 cursor-pointer hover:bg-green-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={form.is_published}
                                    onChange={(e) => setField("is_published", e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded border-2 transition-colors ${
                                    form.is_published
                                        ? 'bg-green-600 border-green-600'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}>
                                    {form.is_published && <CheckSquare className="w-5 h-5 text-white"/>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-green-600"/>
                                    <span className="text-sm font-medium text-green-700">Размещено на сайте</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Футер */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button
                        className="btn-coffeeDark text-sm transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2"
                        onClick={onClose}
                        disabled={pending}
                    >
                        Отмена
                    </button>
                    <button
                        className="flex items-center gap-2 text-[var(--color-primary)] text-sm bg-transparent border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:text-white transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={pending || !form.name.trim()}
                        onClick={onSubmit}
                    >
                        <Plus className="w-4 h-4" />
                        {pending ? "Создание..." : "Создать"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ClusterRegistryPage() {
    const qc = useQueryClient();
    const [projectId, setProjectId] = useState<string>("");

    // 🔎 фильтры и поиск
    const [q, setQ] = useState("");
    const [dirs, setDirs] = useState<string[]>([]);
    const [types, setTypes] = useState<string[]>([]);

    // 🔄 сортировка
    const [sortField, setSortField] = useState<string>("");
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // 📝 модалки
    const [editCluster, setEditCluster] = useState<any | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);

    const projects = useQuery({
        queryKey: ["projects", { archived: false }],
        queryFn: () => fetchProjects({ archived: false })
    });

    const reg = useQuery({
        queryKey: ["cluster_registry", projectId],
        queryFn: () => projectId ? listClusterRegistry(projectId) : Promise.resolve([]),
    });

    const del = useMutation({
        mutationFn: (id: string) => deleteClusterRegistryRow(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["cluster_registry", projectId] }),
    });

    // Функция сортировки
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Компонент заголовка с сортировкой
    const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => {
        const isActive = sortField === field;
        const Icon = isActive
            ? (sortDirection === 'asc' ? ArrowUp : ArrowDown)
            : ArrowUpDown;

        return (
            <button
                className="flex items-center gap-2 font-semibold text-gray-700 hover:text-[var(--color-primary)] transition-colors"
                onClick={() => handleSort(field)}
            >
                {children}
                <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--color-primary)]' : 'text-gray-400'}`} />
            </button>
        );
    };

    // опции для мультиселектов
    const { dirOptions, typeOptions } = useMemo(() => {
        const data = reg.data || [];
        const dirSet = new Set<string>();
        const typeSet = new Set<string>();
        for (const r of data) {
            if (r?.direction) dirSet.add(r.direction);
            if (r?.page_type) typeSet.add(r.page_type);
        }
        return {
            dirOptions: Array.from(dirSet).sort(),
            typeOptions: Array.from(typeSet).sort(),
        };
    }, [reg.data]);

    // клиентская фильтрация и сортировка
    const filtered = useMemo(() => {
        const data = reg.data || [];
        const needle = q.trim().toLowerCase();

        // Фильтрация
        let result = data.filter((r: any) => {
            const okName = !needle || (r.name || "").toLowerCase().includes(needle);
            const okDir = dirs.length === 0 || (r.direction && dirs.includes(r.direction));
            const okType = types.length === 0 || (r.page_type && types.includes(r.page_type));
            return okName && okDir && okType;
        });

        // Сортировка
        if (sortField) {
            result.sort((a, b) => {
                let aVal = a[sortField];
                let bVal = b[sortField];

                // Обработка разных типов данных
                if (sortField === 'demand') {
                    aVal = Number(aVal) || 0;
                    bVal = Number(bVal) || 0;
                } else if (typeof aVal === 'boolean') {
                    aVal = aVal ? 1 : 0;
                    bVal = bVal ? 1 : 0;
                } else {
                    aVal = String(aVal || '').toLowerCase();
                    bVal = String(bVal || '').toLowerCase();
                }

                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [reg.data, q, dirs, types, sortField, sortDirection]);

    // Статистика
    const statistics = useMemo(() => {
        const data = reg.data || [];
        return {
            total: data.length,
            withCore: data.filter(r => r.has_core).length,
            withBrief: data.filter(r => r.has_brief).length,
            published: data.filter(r => r.is_published).length,
            totalDemand: data.reduce((sum, r) => sum + (r.demand || 0), 0)
        };
    }, [reg.data]);

    // CSV импорт
    const [csvUploading, setCsvUploading] = useState(false);
    const [csvResult, setCsvResult] = useState<null | { processed: number; created: number; updated: number; errors: string[] }>(null);

    const onCsvUpload = async (f: File | null) => {
        if (!f || !projectId) return;
        setCsvUploading(true);
        setCsvResult(null);
        try {
            const fd = new FormData();
            fd.append("file", f);
            const r = await api.post(`/cluster-registry/import-csv?project_id=${projectId}`, fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setCsvResult(r.data);
            await reg.refetch();
        } catch (e: any) {
            alert(e?.response?.data?.detail || "Ошибка импорта CSV");
        } finally {
            setCsvUploading(false);
        }
    };

    useEffect(() => {
        if (!projectId && projects.data?.length) setProjectId(projects.data[0].id);
    }, [projects.data, projectId]);

    const resetFilters = () => {
        setQ("");
        setDirs([]);
        setTypes([]);
        setSortField("");
        setSortDirection('asc');
    };

    const hasActiveFilters = q || dirs.length || types.length || sortField;

    return (
        <div className="min-h-screen from-gray-50 via-white to-blue-50/30">
            <div className="p-6 space-y-6">
                {/* Заголовок */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-[var(--color-primary-hover)] text-white">
                            <Database className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text">
                                Семантика
                            </h1>
                            <p className="text-gray-500 mt-1">
                                Управление кластерами и направлениями • Всего: {statistics.total}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 btn-coffeeDark transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2 cursor-pointer">
                            <Upload className="w-4 h-4" />
                            {csvUploading ? "Импортируем..." : "Импорт CSV"}
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => onCsvUpload(e.target.files?.[0] || null)}
                                disabled={csvUploading || !projectId}
                            />
                        </label>

                        <button
                            onClick={() => setShowAddModal(true)}
                            disabled={!projectId}
                            className="flex items-center gap-2 text-[var(--color-primary)] bg-transparent border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:text-white transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                            Добавить кластер
                        </button>
                    </div>
                </div>

                {/* Выбор проекта */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl z-40 relative">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-[var(--color-coffee)] text-[var(--color-coffee-text)]">
                                <Target className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-gray-900">Проект:</span>
                        </div>
                        <div className="relative z-50 flex-1 max-w-md">
                            <Select
                                className="w-full"
                                value={projectId}
                                onChange={(v) => setProjectId(v || "")}
                                options={(projects.data || []).map(p => ({ label: p.name, value: p.id }))}
                                placeholder="Выберите проект"
                            />
                        </div>
                    </div>
                </div>

                {projectId ? (
                    <>
                        {/* Статистические карточки */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm font-medium">Всего кластеров</p>
                                        <p className="text-2xl font-bold text-all mt-1">{statistics.total}</p>
                                    </div>
                                    <div className="p-2 bg-gradient-to-br bg-base rounded-xl">
                                        <BarChart3 className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm font-medium">Ядро</p>
                                        <p className="text-2xl font-bold text-all mt-1">{statistics.withCore}</p>
                                    </div>
                                    <div className="p-2 bg-gradient-to-br bg-blue rounded-xl">
                                        <Target className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm font-medium">С ТЗ</p>
                                        <p className="text-2xl font-bold text-all mt-1">{statistics.withBrief}</p>
                                    </div>
                                    <div className="p-2 bg-gradient-to-br bg-green rounded-xl">
                                        <FileText className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm font-medium">Размещено</p>
                                        <p className="text-2xl font-bold text-all mt-1">{statistics.published}</p>
                                    </div>
                                    <div className="p-2 bg-gradient-to-br bg-pink rounded-xl">
                                        <Globe className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm font-medium">Общий спрос</p>
                                        <p className="text-2xl font-bold text-all mt-1">{statistics.totalDemand}</p>
                                    </div>
                                    <div className="p-2 bg-gradient-to-br bg-purple rounded-xl">
                                        <BarChart3 className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Панель фильтров и поиска */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-gray-700">
                                        <Filter className="w-5 h-5" />
                                        <span className="text-lg font-semibold">Фильтры и поиск</span>
                                    </div>
                                    {hasActiveFilters && (
                                        <button
                                            onClick={resetFilters}
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-3xl btn-pink transition-colors"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Сбросить все
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {/* Поиск */}
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                            placeholder="Поиск по названию..."
                                            value={q}
                                            onChange={(e) => setQ(e.target.value)}
                                        />
                                    </div>

                                    {/* Направления */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Направления ({dirs.length})
                                        </label>
                                        <select
                                            multiple
                                            size={3}
                                            className="w-full border-2 border-[var(--color-primary)]/20 focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] rounded-xl px-3 py-2 text-sm transition-all bg-white/80"
                                            value={dirs}
                                            onChange={(e) => setDirs(Array.from(e.target.selectedOptions).map(o => o.value))}
                                        >
                                            {dirOptions.map((d) => (
                                                <option key={d} value={d} className="py-1">{d}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Типы страниц */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Типы страниц ({types.length})
                                        </label>
                                        <select
                                            multiple
                                            size={3}
                                            className="w-full border-2 border-[var(--color-primary)]/20 focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] rounded-xl px-3 py-2 text-sm transition-all bg-white/80"
                                            value={types}
                                            onChange={(e) => setTypes(Array.from(e.target.selectedOptions).map(o => o.value))}
                                        >
                                            {typeOptions.map((t) => (
                                                <option key={t} value={t} className="py-1">{t}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Активная сортировка */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Сортировка
                                        </label>
                                        <div className="bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl px-4 py-3">
                                            {sortField ? (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-gray-600">По полю:</span>
                                                    <span className="font-medium text-[var(--color-primary)]">
                                                        {sortField === 'name' && 'Название'}
                                                        {sortField === 'direction' && 'Направление'}
                                                        {sortField === 'page_type' && 'Тип страницы'}
                                                        {sortField === 'has_core' && 'Ядро'}
                                                        {sortField === 'has_brief' && 'ТЗ'}
                                                        {sortField === 'is_published' && 'Размещено'}
                                                        {sortField === 'demand' && 'Спрос'}
                                                    </span>
                                                    {sortDirection === 'asc' ? <ArrowUp className="w-4 h-4 text-[var(--color-primary)]" /> : <ArrowDown className="w-4 h-4 text-[var(--color-primary)]" />}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">Кликните на заголовок колонки</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {csvResult && (
                                    <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                                        <div className="flex items-start gap-3">
                                            <CheckSquare className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                            <div className="text-sm">
                                                <div className="font-medium text-green-800 mb-1">Импорт выполнен успешно!</div>
                                                <div className="text-green-700">
                                                    Обработано: <strong>{csvResult.processed}</strong> •
                                                    Создано: <strong>{csvResult.created}</strong> •
                                                    Обновлено: <strong>{csvResult.updated}</strong>
                                                </div>
                                                {csvResult.errors?.length > 0 && (
                                                    <div className="mt-2">
                                                        <div className="font-medium text-red-800">Ошибки:</div>
                                                        <ul className="list-disc ml-5 mt-1 text-red-600">
                                                            {csvResult.errors.map((er, i) => <li key={i}>{er}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Таблица с отдельными колонками */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <Database className="w-5 h-5 text-[var(--color-primary)]" />
                                        Данные реестра
                                    </h3>
                                    <div className="text-sm text-gray-600">
                                        Показано: <span className="font-semibold">{filtered.length}</span> из <span className="font-semibold">{reg.data?.length ?? 0}</span>
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-2xl border border-gray-200/50">
                                    {/* Заголовки с сортировкой */}
                                    <div className="grid grid-cols-8 gap-4 px-6 py-4 bg-gray-50 text-sm border-b border-gray-200">
                                        <div><SortableHeader field="name">Кластер</SortableHeader></div>
                                        <div><SortableHeader field="direction">Направление</SortableHeader></div>
                                        <div><SortableHeader field="page_type">Тип страницы</SortableHeader></div>
                                        <div className="text-center"><SortableHeader field="has_core">Ядро</SortableHeader></div>
                                        <div className="text-center"><SortableHeader field="has_brief">ТЗ</SortableHeader></div>
                                        <div className="text-center"><SortableHeader field="is_published">Опубликовано</SortableHeader></div>
                                        <div className="text-center"><SortableHeader field="demand">Спрос</SortableHeader></div>
                                        <div className="text-center">Действия</div>
                                    </div>

                                    {/* Строки */}
                                    <div className="divide-y divide-gray-100">
                                        {filtered.map((r: any, index: number) => (
                                            <div key={r.id} className={`grid grid-cols-8 gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                                                <div className="font-medium text-gray-800 truncate" title={r.name}>{r.name}</div>
                                                <div className="text-sm text-gray-600">{r.direction || "—"}</div>
                                                <div className="text-sm text-gray-600">{r.page_type || "—"}</div>

                                                {/* Ядро */}
                                                <div className="flex justify-center">
                                                    {r.has_core ?
                                                        <CheckSquare className="w-5 h-5 text-blue-600" title="Ядро" /> :
                                                        <Square className="w-5 h-5 text-gray-300" title="Нет ядра" />
                                                    }
                                                </div>

                                                {/* ТЗ */}
                                                <div className="flex justify-center">
                                                    {r.has_brief ?
                                                        <CheckSquare className="w-5 h-5 text-purple-600" title="Есть ТЗ" /> :
                                                        <Square className="w-5 h-5 text-gray-300" title="Нет ТЗ" />
                                                    }
                                                </div>

                                                {/* Опубликовано */}
                                                <div className="flex justify-center">
                                                    {r.is_published ?
                                                        <CheckSquare className="w-5 h-5 text-green-600" title="Опубликовано" /> :
                                                        <Square className="w-5 h-5 text-gray-300" title="Не опубликовано" />
                                                    }
                                                </div>

                                                {/* Спрос */}
                                                <div className="text-center text-sm font-medium">{r.demand || 0}</div>

                                                {/* Действия */}
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => setEditCluster(r)}
                                                        className="p-2 text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] hover:bg-[var(--color-primary)]/10 rounded-xl transition-all"
                                                        title="Редактировать"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Удалить этот кластер?')) {
                                                                del.mutate(r.id);
                                                            }
                                                        }}
                                                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                                                        title="Удалить"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {filtered.length === 0 && (
                                        <div className="text-center py-12 text-gray-400 bg-white">
                                            <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                            <div className="text-lg font-medium mb-1">
                                                {hasActiveFilters ? "Ничего не найдено" : "Реестр пуст"}
                                            </div>
                                            <div className="text-sm">
                                                {hasActiveFilters ? "Попробуйте изменить параметры поиска" : "Добавьте первый кластер в реестр"}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-16">
                        <div className="w-24 h-24 bg-[var(--color-coffee)]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Target className="w-12 h-12 text-[var(--color-coffee-text)]" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">Выберите проект</h3>
                        <p className="text-gray-500">Для работы с реестром кластеров необходимо выбрать активный проект</p>
                    </div>
                )}

                {/* Модалки */}
                <ClusterEditModal
                    open={!!editCluster}
                    cluster={editCluster}
                    onClose={() => setEditCluster(null)}
                    onSaved={() => {
                        setEditCluster(null);
                        qc.invalidateQueries({ queryKey: ["cluster_registry", projectId] });
                    }}
                />

                <ClusterAddModal
                    open={showAddModal}
                    projectId={projectId}
                    onClose={() => setShowAddModal(false)}
                    onSaved={() => {
                        setShowAddModal(false);
                        qc.invalidateQueries({ queryKey: ["cluster_registry", projectId] });
                    }}
                />
            </div>
        </div>
    );
}