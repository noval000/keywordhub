"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, deleteProject } from "@/lib/api";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import ImportModal from "@/components/ImportModal";
import EditProjectModal from "@/components/projects/EditProjectModal";
import ConfirmDeleteModal from "@/components/projects/ConfirmDeleteModal";
import GlobalDeleteModal from "@/components/queries/GlobalDeleteModal";
import {
    FolderOpen,
    Search,
    Filter,
    Settings,
    Trash2,
    Edit,
    Download,
    Upload,
    RefreshCw,
    CheckSquare,
    Square,
    Database,
    Globe,
    MapPin,
    Archive,
    Calendar,
    Tag,
    FileText,
    Activity,
    History,
    RotateCcw,
    Zap,
    Target,
    Hash,
    Clock,
    Eye,
    BarChart3,
    AlertTriangle,
    CheckCircle2,
    XCircle,
} from "lucide-react";

type QueryRow = {
    id: string;
    phrase: string;
    direction?: string | null;
    cluster?: string | null;
    page?: string | null;
    tags: string[];
    page_type?: string | null;
    query_type?: string | null;
    ws_flag: number;
    dt?: string | null;
};

type BulkPayload = {
    ids: string[];
    set_cluster?: string;
    set_direction?: string;
    set_page?: string;
    set_tags?: string[];
    add_tags?: string[];
    remove_tags?: string[];
    set_page_type?: string;
    set_query_type?: string;
    set_ws_flag?: number;
    set_dt?: string; // "YYYY-MM-DD", "" = очистить, undefined = не менять
};

type ProjectItem = {
    id: string;
    name: string;
    region?: string | null;
    domain?: string | null;
    is_archived: boolean;
};

export default function ProjectCorePage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const projectId = params.id;
    const searchParams = useSearchParams();

    const [showGlobalDelete, setShowGlobalDelete] = useState(false);
    const [search, setSearch] = useState(searchParams.get("q") ?? "");
    const [direction, setDirection] = useState("");
    const [cluster, setCluster] = useState("");

    // Сведения о проекте (для шапки и модалок)
    const [projectName, setProjectName] = useState<string>("");
    const [projectRegion, setProjectRegion] = useState<string | undefined>(undefined);
    const [projectDomain, setProjectDomain] = useState<string | undefined>(undefined);
    const [isArchived, setIsArchived] = useState<boolean>(false);

    const [showEdit, setShowEdit] = useState(false);
    const [showDelete, setShowDelete] = useState(false);

    const [selected, setSelected] = useState<string[]>([]);
    const gridRef = useRef<AgGridReact<QueryRow>>(null);
    const qc = useQueryClient();

    // Загрузка проекта (берём из списка и находим по id)
    const projects = useQuery({
        queryKey: ["projects"],
        queryFn: async () => (await api.get<ProjectItem[]>("/projects", { params: { include_archived: true } })).data,
    });

    const totalQueries = useQuery({
        queryKey: ["queries_count", projectId, search, direction, cluster],
        queryFn: async () => (await api.get<{ total: number }>("/queries/count", {
            params: {
                project_id: projectId,
                search: search || undefined,
                direction: direction || undefined,
                cluster: cluster || undefined,
            },
        })).data.total,
    });

    useEffect(() => {
        if (!projects.data) return;
        const p = projects.data.find((x) => x.id === projectId);
        if (p) {
            setProjectName(p.name);
            setProjectRegion(p.region ?? undefined);
            setProjectDomain(p.domain ?? undefined);
            setIsArchived(!!p.is_archived);
        }
    }, [projects.data, projectId]);

    const queries = useQuery({
        queryKey: ["queries", projectId, search, direction, cluster],
        queryFn: async () => {
            const r = await api.get<QueryRow[]>("/queries", {
                params: {
                    project_id: projectId,
                    search: search || undefined,
                    direction: direction || undefined,
                    cluster: cluster || undefined,
                    limit: 200,
                    offset: 0,
                },
            });
            return r.data;
        },
    });

    // Добавляем эти запросы после существующих useQuery
    const statisticsFromDB = useQuery({
        queryKey: ["queries_statistics", projectId, search, direction, cluster],
        queryFn: async () => {
            const response = await api.get<{
                total: number;
                with_direction: number;
                with_cluster: number;
                with_page: number;
                with_tags: number;
            }>("/queries/statistics", {
                params: {
                    project_id: projectId,
                    search: search || undefined,
                    direction: direction || undefined,
                    cluster: cluster || undefined,
                },
            });
            return response.data;
        },
    });

    const directions = useQuery({
        queryKey: ["dict_directions", projectId],
        queryFn: async () => (await api.get<string[]>(`/dicts/projects/${projectId}/directions`)).data,
    });
    const clusters = useQuery({
        queryKey: ["dict_clusters", projectId],
        queryFn: async () => (await api.get<string[]>(`/dicts/projects/${projectId}/clusters`)).data,
    });

    // Статистика для карточек
    const statistics = useMemo(() => {
        const data = queries.data || [];
        return {
            total: data.length,
            withDirection: data.filter(q => q.direction).length,
            withCluster: data.filter(q => q.cluster).length,
            withPage: data.filter(q => q.page).length,
            withTags: data.filter(q => q.tags && q.tags.length > 0).length,
        };
    }, [queries.data]);

    useEffect(() => {
        setSelected([]);
    }, [search, direction, cluster]);

    const columnDefs = useMemo<ColDef<QueryRow>[]>(() => [
        { headerName: "", checkboxSelection: true, headerCheckboxSelection: true, width: 50, pinned: "left" },
        { headerName: "Фраза", field: "phrase", flex: 2, sortable: true },
        { headerName: "Направление", field: "direction", flex: 1, sortable: true },
        { headerName: "Кластер", field: "cluster", flex: 1, sortable: true },
        { headerName: "Страница", field: "page", flex: 2 },
        { headerName: "Теги", valueGetter: (p) => (p.data?.tags || []).join(","), flex: 1 },
        { headerName: "Тип страницы", field: "page_type", flex: 1 },
        { headerName: "Тип запроса", field: "query_type", flex: 1 },
        { headerName: "WS", field: "ws_flag", width: 100 },
        { headerName: "Дата", field: "dt", width: 140 },
    ], []);

    const del = useMutation({
        mutationFn: async () =>
            (await api.post(`/queries/delete`, { ids: selected }, { params: { project_id: projectId } })).data,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["queries", projectId] });
            setSelected([]);
        },
    });

    const onSelectionChanged = () => {
        const ids = gridRef.current?.api.getSelectedRows().map((r) => r.id) || [];
        setSelected(ids);
    };

    const bulk = useMutation({
        mutationFn: async (payload: BulkPayload) =>
            (await api.post(`/queries/bulk`, payload, { params: { project_id: projectId } })).data,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["queries", projectId] });
            setSelected([]);
        },
    });

    const undo = useMutation({
        mutationFn: async (to_version?: number) =>
            (await api.post(`/queries/undo`, { ids: selected, to_version }, { params: { project_id: projectId } })).data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["queries", projectId] }),
    });

    const [bulkFields, setBulkFields] = useState<BulkPayload>({
        ids: [],
        set_cluster: undefined,
        set_direction: undefined,
        set_page: undefined,
        add_tags: [],
        remove_tags: [],
        set_page_type: undefined,
        set_query_type: undefined,
        set_ws_flag: undefined,
        set_dt: undefined,
    });

    const [versionLog, setVersionLog] = useState<any[] | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [importedCount, setImportedCount] = useState<number | null>(null);

    const exportCsvUrl = useMemo(() => {
        const base = `${process.env.NEXT_PUBLIC_API_URL}/queries/export.csv`;
        const u = new URL(base!);
        u.searchParams.set("project_id", projectId);
        if (search) u.searchParams.set("search", search);
        if (direction) u.searchParams.set("direction", direction);
        if (cluster) u.searchParams.set("cluster", cluster);
        return u.toString();
    }, [projectId, search, direction, cluster]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
            <div className="p-6 space-y-6">
                {/* Заголовок проекта */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                                <FolderOpen className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-bold text-gray-900">
                                        {projectName || "Проект"}
                                    </h1>
                                    {isArchived && (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 border border-amber-200 text-amber-700">
                                            <Archive className="w-3 h-3" />
                                            Архив
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                    {projectRegion && (
                                        <div className="flex items-center gap-1">
                                            <MapPin className="w-4 h-4" />
                                            {projectRegion}
                                        </div>
                                    )}
                                    {projectDomain && (
                                        <div className="flex items-center gap-1">
                                            <Globe className="w-4 h-4" />
                                            {projectDomain}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        <Database className="w-4 h-4" />
                                        {totalQueries.data ?? "—"} запросов
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowEdit(true)}
                                className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-white/80 rounded-xl transition-all duration-200 border border-gray-200/50"
                            >
                                <Edit className="w-4 h-4" />
                                Редактировать
                            </button>
                            <button
                                onClick={() => setShowDelete(true)}
                                className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all duration-200 border border-red-200"
                            >
                                <Trash2 className="w-4 h-4" />
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>

                {/* Статистические карточки */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Всего запросов</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {statisticsFromDB.data?.total ?? totalQueries.data ?? "—"}
                                </p>
                                {statisticsFromDB.isLoading && (
                                    <p className="text-xs text-gray-400 mt-0.5">Загрузка...</p>
                                )}
                            </div>
                            <div className="p-2 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl">
                                <Database className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">С направлением</p>
                                <p className="text-2xl font-bold text-blue-600 mt-1">
                                    {statisticsFromDB.data?.with_direction ?? "—"}
                                </p>
                                {statisticsFromDB.isLoading && (
                                    <p className="text-xs text-gray-400 mt-0.5">Загрузка...</p>
                                )}
                            </div>
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                                <Target className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">С кластером</p>
                                <p className="text-2xl font-bold text-purple-600 mt-1">
                                    {statisticsFromDB.data?.with_cluster ?? "—"}
                                </p>
                                {statisticsFromDB.isLoading && (
                                    <p className="text-xs text-gray-400 mt-0.5">Загрузка...</p>
                                )}
                            </div>
                            <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
                                <Hash className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Со страницей</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">
                                    {statisticsFromDB.data?.with_page ?? "—"}
                                </p>
                                {statisticsFromDB.isLoading && (
                                    <p className="text-xs text-gray-400 mt-0.5">Загрузка...</p>
                                )}
                            </div>
                            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">С тегами</p>
                                <p className="text-2xl font-bold text-orange-600 mt-1">
                                    {statisticsFromDB.data?.with_tags ?? "—"}
                                </p>
                                {statisticsFromDB.isLoading && (
                                    <p className="text-xs text-gray-400 mt-0.5">Загрузка...</p>
                                )}
                            </div>
                            <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl">
                                <Tag className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Панель фильтров */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-gray-700">
                                <Filter className="w-5 h-5" />
                                <span className="text-sm font-medium">Фильтры и поиск</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Поиск */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Поиск по фразе..."
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                />
                            </div>

                            {/* Направление */}
                            <div className="relative">
                                <Target className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    value={direction}
                                    onChange={(e) => setDirection(e.target.value)}
                                    placeholder="Направление..."
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                    list="dirlist"
                                />
                                <datalist id="dirlist">
                                    {(directions.data || []).map((d) => <option key={d} value={d}/>)}
                                </datalist>
                            </div>

                            {/* Кластер */}
                            <div className="relative">
                                <Hash className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    value={cluster}
                                    onChange={(e) => setCluster(e.target.value)}
                                    placeholder="Кластер..."
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                    list="clulist"
                                />
                                <datalist id="clulist">
                                    {(clusters.data || []).map((c) => <option key={c} value={c}/>)}
                                </datalist>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600 font-medium">
                                    Всего строк: {totalQueries.data ?? "—"}
                                </span>
                                {importedCount !== null && (
                                    <div className="flex items-center gap-1 text-sm text-green-600">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Импортировано: {importedCount}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <a
                                    href={exportCsvUrl}
                                    className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all duration-200 border border-blue-200"
                                >
                                    <Download className="w-4 h-4" />
                                    Экспорт CSV
                                </a>

                                <button
                                    onClick={() => setShowImport(true)}
                                    className="flex items-center gap-2 px-4 py-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-xl transition-all duration-200 border border-green-200"
                                >
                                    <Upload className="w-4 h-4" />
                                    Импорт
                                </button>

                                <button
                                    onClick={() => setShowGlobalDelete(true)}
                                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all duration-200 border border-red-200"
                                >
                                    <AlertTriangle className="w-4 h-4" />
                                    Глобальное удаление
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Таблица */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl">
                    <div className="ag-theme-quartz rounded-2xl overflow-hidden border border-gray-200/50" style={{height: 560, width: "100%"}}>
                        <AgGridReact<QueryRow>
                            ref={gridRef}
                            rowSelection="multiple"
                            rowData={queries.data || []}
                            columnDefs={columnDefs}
                            onSelectionChanged={onSelectionChanged}
                            animateRows
                            suppressCellFocus
                            rowMultiSelectWithClick
                            headerHeight={40}
                            rowHeight={45}
                        />
                    </div>
                </div>

                {/* Панель массовых действий */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl">
                    <div className="space-y-6">
                        {/* Заголовок */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Массовые действия</h3>
                                    <p className="text-sm text-gray-500">
                                        Выбрано: {selected.length} из {queries.data?.length || 0}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => gridRef.current?.api.selectAll()}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                                >
                                    <CheckSquare className="w-4 h-4" />
                                    Выделить всё
                                </button>
                                <button
                                    onClick={() => gridRef.current?.api.deselectAll()}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                                >
                                    <Square className="w-4 h-4" />
                                    Снять выделение
                                </button>
                            </div>
                        </div>

                        {/* Поля для массового редактирования */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    placeholder="Кластер"
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                    value={bulkFields.set_cluster || ""}
                                    onChange={(e) => setBulkFields((s) => ({ ...s, set_cluster: e.target.value || undefined }))}
                                />
                            </div>

                            <div className="relative">
                                <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    placeholder="Направление"
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                    value={bulkFields.set_direction || ""}
                                    onChange={(e) => setBulkFields((s) => ({ ...s, set_direction: e.target.value || undefined }))}
                                />
                            </div>

                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    placeholder="Страница"
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                    value={bulkFields.set_page ?? ""}
                                    onChange={e => setBulkFields(s => ({ ...s, set_page: e.target.value || undefined }))}
                                />
                            </div>

                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    placeholder="Установить теги (через запятую)"
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                    onChange={(e) => setBulkFields((s) => ({ ...s, set_tags: e.target.value ? e.target.value.split(",").map((x) => x.trim()).filter(Boolean) : undefined }))}
                                />
                            </div>

                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    placeholder="Добавить теги (через запятую)"
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200"
                                    onChange={(e) => setBulkFields((s) => ({ ...s, add_tags: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))}
                                />
                            </div>

                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    placeholder="Удалить теги (через запятую)"
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all duration-200"
                                    onChange={(e) => setBulkFields((s) => ({ ...s, remove_tags: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))}
                                />
                            </div>

                            <input
                                placeholder="Тип страницы"
                                className="px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                onChange={(e) => setBulkFields((s) => ({ ...s, set_page_type: e.target.value || undefined }))}
                            />

                            <input
                                placeholder="Тип запроса"
                                className="px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                onChange={(e) => setBulkFields((s) => ({ ...s, set_query_type: e.target.value || undefined }))}
                            />

                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    placeholder="Wordstat"
                                    className="flex-1 px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setBulkFields((s) => ({ ...s, set_ws_flag: v === "" ? undefined : Math.max(0, Number(v)) }));
                                    }}
                                />
                            </div>
                        </div>

                        {/* Дата */}
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">Дата:</span>
                            <input
                                type="date"
                                className="px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                value={bulkFields.set_dt && bulkFields.set_dt !== "" ? bulkFields.set_dt : ""}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setBulkFields((s) => ({ ...s, set_dt: v === "" ? undefined : v }));
                                }}
                            />
                            <button
                                onClick={() => setBulkFields((s) => ({ ...s, set_dt: "" }))}
                                className="px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg border border-orange-200 transition-colors"
                            >
                                Очистить
                            </button>
                            <button
                                onClick={() => setBulkFields((s) => ({ ...s, set_dt: undefined }))}
                                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                            >
                                Не менять
                            </button>
                        </div>

                        {/* Кнопки действий */}
                        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                            <button
                                disabled={!selected.length || bulk.isPending}
                                onClick={() => bulk.mutate({ ...bulkFields, ids: selected })}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Zap className="w-4 h-4" />
                                {bulk.isPending ? "Применение..." : "Применить к выбранным"}
                            </button>

                            <button
                                disabled={!selected.length || del.isPending}
                                onClick={() => {
                                    if (confirm(`Удалить ${selected.length} строк(и)? Это действие необратимо.`)) {
                                        del.mutate();
                                    }
                                }}
                                className="flex items-center gap-2 px-6 py-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all duration-200 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                {del.isPending ? "Удаление..." : "Удалить выбранные"}
                            </button>

                            <button
                                disabled={selected.length !== 1}
                                onClick={async () => {
                                    const id = selected[0];
                                    const r = await api.get(`/queries/${id}/versions`);
                                    setVersionLog(r.data);
                                }}
                                className="flex items-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <History className="w-4 h-4" />
                                История версий
                            </button>

                            <button
                                disabled={!selected.length || undo.isPending}
                                onClick={() => undo.mutate()}
                                className="flex items-center gap-2 px-4 py-3 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-xl transition-all duration-200 border border-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RotateCcw className="w-4 h-4" />
                                {undo.isPending ? "Откат..." : "Откатить"}
                            </button>
                        </div>

                        {/* История версий */}
                        {versionLog && (
                            <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <History className="w-5 h-5 text-gray-600" />
                                    <h4 className="font-medium text-gray-900">История версий выбранной строки</h4>
                                </div>
                                <div className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white p-3">
                                    <pre className="text-xs text-gray-600">{JSON.stringify(versionLog, null, 2)}</pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showImport && (
                <ImportModal
                    projectId={projectId}
                    onClose={() => setShowImport(false)}
                    onImported={(count) => {
                        // Этот callback вызывается только при успешном импорте
                        setImportedCount(count);

                        // Обновляем все запросы
                        qc.invalidateQueries({ queryKey: ["queries", projectId] });
                        qc.invalidateQueries({ queryKey: ["queries_count", projectId] });
                        qc.invalidateQueries({ queryKey: ["queries_statistics", projectId] });

                        console.log(`Успешно импортировано ${count} записей`);
                    }}
                    directions={directions.data || []}
                    clusters={clusters.data || []}
                />
            )}

            {showEdit && (
                <EditProjectModal
                    id={projectId}
                    initial={{ name: projectName, region: projectRegion, domain: projectDomain, is_archived: isArchived }}
                    onClose={() => setShowEdit(false)}
                    onSaved={(p) => {
                        setProjectName(p.name);
                        setProjectRegion(p.region);
                        setProjectDomain(p.domain);
                        setIsArchived(p.is_archived);
                        setShowEdit(false);
                        qc.invalidateQueries({ queryKey: ["projects"] });
                    }}
                />
            )}

            {showDelete && (
                <ConfirmDeleteModal
                    onCancel={() => setShowDelete(false)}
                    onConfirm={async (hard) => {
                        await deleteProject(projectId, hard);
                        setShowDelete(false);
                        router.push("/projects");
                    }}
                />
            )}

            {showGlobalDelete && (
                <GlobalDeleteModal
                    onClose={() => setShowGlobalDelete(false)}
                    onDone={(deleted) => {
                        qc.invalidateQueries({ queryKey: ["queries", projectId] });
                    }}
                />
            )}
        </div>
    );
}