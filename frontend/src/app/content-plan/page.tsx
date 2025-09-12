"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import '../globals.css'

import type { AgGridReact as AgGridReactType } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import {
    Pencil,
    Link2,
    RotateCcw,
    FileText,
    Stethoscope,
    Globe,
    SlidersHorizontal,
    ListFilter,
    Shrink,
    Expand,
    Wand2,
    Search,
    Calendar,
    User,
    Plus,
    Download,
    Trash2,
    CheckSquare,
    Square,
    Eye,
    Filter,
    BarChart3,
    Clock,
    CheckCircle,
    AlertTriangle,
    TrendingUp,
    ExternalLink,
} from "lucide-react";

import {
    cpList,
    cpCount,
    cpDelete,
    type CPItem,
    fetchProjects,
    type ProjectDto,
} from "@/lib/api";

import ContentPlanImportModal from "@/components/content-plan/ContentPlanImportModal";
import ContentPlanAddModal from "@/components/content-plan/ContentPlanAddModal";
import ContentPlanEditModal from "@/components/content-plan/ContentPlanEditModal";
import ContentPlanProjectsModal from "@/components/content-plan/ContentPlanProjectsModal";

import {
    normalizeUrl,
    formatPeriodRuFromMonthInput,
} from "@/lib/cp-utils";
import UserSelect from "@/components/ui/UserSelect";
import TZCreateModal from "@/components/tz/TZCreateModal";
import {TZButton} from "@/components/tz/TZButton";
import TZViewModal from "@/components/tz/TZViewModal";
import Select from "@/components/ui/Select";

/* ---------- constants ---------- */

const STATUS_OPTIONS = [
    "ТЗ в разработке",
    "ТЗ готово",
    "В работе",
    "Можно размещать",
    "Внести СЕО правки",
    "Отправлено на размещение",
    "Размещено",
] as const;

function statusBadgeClasses(status?: string | null) {
    const base = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors";
    switch (status) {
        case "Можно размещать":
            return `${base} bg-red-100 border border-red-200 text-red-700 hover:bg-red-200`;
        case "Отправлено на размещение":
            return `${base} bg-yellow-100 border border-yellow-200 text-yellow-700 hover:bg-yellow-200`;
        case "Размещено":
            return `${base} bg-green-100 border border-green-200 text-green-700 hover:bg-green-200`;
        case "В работе":
            return `${base} bg-blue-100 border border-blue-200 text-blue-700 hover:bg-blue-200`;
        case "ТЗ готово":
            return `${base} bg-purple-100 border border-purple-200 text-purple-700 hover:bg-purple-200`;
        default:
            return `${base} bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200`;
    }
}

/* ---------- helpers ---------- */

type Grouped = {
    key: string;
    sample: CPItem;
    projectIds: string[];
    perProject: Record<string, string>; // project_id -> item_id
};

function buildKey(r: CPItem) {
    return `${r.topic || ""}|${r.period || ""}|${r.section || ""}|${r.direction || ""}`;
}

function ActionsRenderer(p: ICellRendererParams<Grouped, any>) {
    const g = p.data!;
    const openEdit = p.context?.openEdit as (g: Grouped) => void;
    const openProjects = p.context?.openProjects as (g: Grouped) => void;



    return (
        <div className="h-full w-full flex items-center justify-center gap-2">
            <button
                className="p-2 rounded-xl text-[var(--color-primary)] bg-white/80 border-2 border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] transition-all duration-200 shadow-sm hover:shadow-md"
                title="Редактировать"
                onClick={(e) => {
                    e.stopPropagation();
                    openEdit(g);
                }}
            >
                <Pencil size={16} />
            </button>
            <button
                className="p-2 rounded-xl text-[var(--color-coffee-text)] bg-[var(--color-coffee)]/60 border-2 border-[var(--color-coffee)] hover:bg-[var(--color-coffee)] hover:text-[var(--color-coffee-text)] transition-all duration-200 shadow-sm hover:shadow-md"
                title="Привязать к проектам"
                onClick={(e) => {
                    e.stopPropagation();
                    openProjects(g);
                }}
            >
                <Link2 size={16} />
            </button>
        </div>
    );
}

function LinkBtn({
                     url,
                     label,
                     icon,
                 }: {
    url?: string | null;
    label: string;
    icon: "tz" | "review" | "page";
}) {
    if (!url || !url.trim()) {
        return <span className="text-gray-400 text-xs">—</span>;
    }

    const href = normalizeUrl(url) ?? url;
    const Icon = icon === "tz" ? FileText : icon === "review" ? Stethoscope : Globe;

    const colorClasses = {
        tz: "text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200",
        review: "text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200",
        page: "text-purple-600 hover:text-purple-700 hover:bg-purple-50 border-purple-200",
    };

    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-white/80 backdrop-blur-sm transition-all duration-200 hover:shadow-md ${colorClasses[icon]}`}
            title={href}
            onClick={(e) => e.stopPropagation()}
        >
            <Icon size={14} />
            {label}
        </a>
    );
}

export default function ContentPlanPage() {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<string>("");
    const [period, setPeriod] = useState<string>("");
    const [periodMonthUI, setPeriodMonthUI] = useState<string>("");
    const [author, setAuthor] = useState("");
    const [reviewingDoctor, setReviewingDoctor] = useState("");
    const [doctorSuggestions, setDoctorSuggestions] = useState<string[]>([]);
    const [showDoctorSuggestions, setShowDoctorSuggestions] = useState(false);

    const [compact, setCompact] = useState(true); // компактный режим

    const [showImport, setShowImport] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editGroup, setEditGroup] = useState<Grouped | null>(null);
    const [projectsGroup, setProjectsGroup] = useState<Grouped | null>(null);

    const [showTZModal, setShowTZModal] = useState(false);
    const [selectedContentPlanItem, setSelectedContentPlanItem] = useState<CPItem | null>(null);
    const [editingTZId, setEditingTZId] = useState<string | null>(null);
    const [tzMode, setTZMode] = useState<'create' | 'edit'>('create');
    const [selectedItem, setSelectedItem] = useState<CPItem | null>(null);
    const [showTZViewModal, setShowTZViewModal] = useState(false);






    const [selectionKeys, setSelectionKeys] = useState<string[]>([]);
    const gridRef = useRef<AgGridReactType<Grouped>>(null);
    const qc = useQueryClient();
    const [tick, setTick] = useState(0);

    const projectsQ = useQuery<ProjectDto[]>({
        queryKey: ["projects", { archived: false }],
        queryFn: () => fetchProjects({ archived: false }),
    });

    const listQ = useQuery({
        queryKey: ["cp_flat", search, status, period, author, reviewingDoctor, tick],
        queryFn: () =>
            cpList({
                search: search || undefined,
                status: status || undefined,
                period: period || undefined,
                author: author || undefined,
                reviewing_doctor: reviewingDoctor || undefined,
                limit: 500,
                offset: 0,
            }),
    });

    const totalQ = useQuery({
        queryKey: ["cp_count", search, status, period, author, reviewingDoctor, tick],
        queryFn: () =>
            cpCount({
                search: search || undefined,
                status: status || undefined,
                period: period || undefined,
                author: author || undefined,
                reviewing_doctor: reviewingDoctor || undefined,
            }),
    });

    const { grouped, byKey } = useMemo(() => {
        const rows = listQ.data || [];
        const map = new Map<string, Grouped>();
        for (const r of rows) {
            const k = buildKey(r);
            const g = map.get(k);
            if (!g) {
                map.set(k, {
                    key: k,
                    sample: { ...r, project_id: null },
                    projectIds: r.project_id ? [r.project_id] : [],
                    perProject: r.project_id ? { [r.project_id]: r.id } : {},
                });
            } else {
                if (r.project_id && !g.projectIds.includes(r.project_id)) {
                    g.projectIds.push(r.project_id);
                    g.perProject[r.project_id] = r.id;
                }
            }
        }
        return { grouped: Array.from(map.values()), byKey: map };
    }, [listQ.data]);

    // Получаем уникальных врачей из данных
    const uniqueDoctors = useMemo(() => {
        const doctors = new Set<string>();
        const rows = listQ.data || [];
        for (const row of rows) {
            if (row.reviewing_doctor && row.reviewing_doctor.trim()) {
                doctors.add(row.reviewing_doctor.trim());
            }
        }
        return Array.from(doctors).sort();
    }, [listQ.data]);

// Фильтруем врачей по введенному тексту
    const filteredDoctors = useMemo(() => {
        if (!reviewingDoctor) return uniqueDoctors.slice(0, 10); // показываем первые 10
        return uniqueDoctors
            .filter(doctor => doctor.toLowerCase().includes(reviewingDoctor.toLowerCase()))
            .slice(0, 10); // ограничиваем до 10 результатов
    }, [uniqueDoctors, reviewingDoctor]);

    // счётчики по статусам (по сгруппированным записям)
    const statusCounters = useMemo(() => {
        const c: Record<string, number> = {};
        for (const s of STATUS_OPTIONS) c[s] = 0;
        for (const g of grouped) {
            const s = g.sample.status || "";
            if (s in c) c[s] += 1;
        }
        return c;
    }, [grouped]);

    // Общая статистика для карточек
    const statistics = useMemo(() => {
        return {
            total: grouped.length,
            canPlace: statusCounters["Можно размещать"] || 0,
            sent: statusCounters["Отправлено на размещение"] || 0,
            placed: statusCounters["Размещено"] || 0,
            inWork: statusCounters["В работе"] || 0,
        };
    }, [grouped, statusCounters]);

    // пресеты
    const presets: Array<{ name: string; apply: () => void; icon: any }> = [
        {
            name: "Текущий месяц",
            icon: Calendar,
            apply: () => {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, "0");
                const ym = `${y}-${m}`;
                setPeriodMonthUI(ym);
                setPeriod(formatPeriodRuFromMonthInput(ym) || "");
                setStatus("");
            },
        },
        {
            name: "В работе",
            icon: Clock,
            apply: () => {
                setPeriod("");
                setPeriodMonthUI("");
                setStatus("В работе");
            },
        },
        {
            name: "ТЗ готово",
            icon: CheckCircle,
            apply: () => {
                setPeriod("");
                setPeriodMonthUI("");
                setStatus("ТЗ готово");
            },
        },
        {
            name: "Можно размещать",
            icon: AlertTriangle,
            apply: () => {
                setPeriod("");
                setPeriodMonthUI("");
                setStatus("Можно размещать");
            },
        },
        {
            name: "Размещено",
            icon: CheckCircle,
            apply: () => {
                setPeriod("");
                setPeriodMonthUI("");
                setStatus("Размещено");
            },
        },
    ];

    const gridContext = useMemo(
        () => ({
            openEdit: (g: Grouped) => setEditGroup(g),
            openProjects: (g: Grouped) => setProjectsGroup(g),
        }),
        []
    );

    const cols = useMemo<ColDef<Grouped>[]>(() => {
        return [
            {
                headerName: "",
                checkboxSelection: true,
                headerCheckboxSelection: true,
                width: 50,
                pinned: "left",
            },
            {
                headerName: "",
                field: "actions",
                width: 100,
                pinned: "left",
                cellRenderer: ActionsRenderer,
                suppressMenu: true,
                sortable: false,
                filter: false,
                suppressNavigable: true,
            },
            {
                headerName: "Период",
                valueGetter: (p) => p.data?.sample.period ?? "",
                width: 130,
                pinned: "left",
                tooltipValueGetter: (p) => p.data?.sample.period ?? "",
            },
            {
                headerName: "Статус",
                width: 180,
                pinned: "left",
                cellRenderer: (p: ICellRendererParams<Grouped>) => {
                    const s = p.data?.sample.status ?? "";
                    return <span className={statusBadgeClasses(s)} title={s || "—"}>{s || "—"}</span>;
                },
            },
            {
                headerName: "Тема",
                valueGetter: (p) => p.data?.sample.topic ?? "",
                flex: 2,
                minWidth: 250,
                tooltipValueGetter: (p) => p.data?.sample.topic ?? "",
            },
            {
                headerName: "Направление",
                valueGetter: (p) => p.data?.sample.direction ?? "",
                flex: 1,
                minWidth: 140,
                tooltipValueGetter: (p) => p.data?.sample.direction ?? "",
            },
            {
                headerName: "ТЗ",
                field: "tz",
                width: 180,
                cellRenderer: (params: any) => {
                    if (!params.data) {
                        return null;
                    }

                    const groupedItem = params.data; // это Grouped объект
                    const item = groupedItem.sample; // получаем CPItem из sample
                    const tz = item.tz;

                    // Логика 1: Если заполнена внешняя ссылка на ТЗ - показываем её (приоритет)
                    if (tz && typeof tz === 'string' && tz.trim() !== '') {
                        return (
                            <a
                                href={normalizeUrl(tz)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 btn-coffeeDark text-white rounded-3xl text-xs transition-colors"
                                title="Открыть внешнее ТЗ"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <ExternalLink size={14} />
                                ТЗ
                            </a>
                        );
                    }

                    // Логика 2: Если есть ТЗ в приложении - показываем кнопку просмотра
                    if (item.has_technical_specification && item.technical_specification_id) {
                        return (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('Opening TZ for item:', item);
                                    setSelectedItem(item); // передаем CPItem, а не Grouped
                                    setShowTZViewModal(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 btn-coffeeDark text-white rounded-3xl text-xs transition-colors"
                                title="Открыть техническое задание"
                            >
                                <Eye size={14} />
                                Открыть ТЗ
                            </button>
                        );
                    }

                    // Логика 3: Если ничего нет - показываем кнопку создания
                    return (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Creating TZ for item:', item);
                                setSelectedContentPlanItem(item); // передаем CPItem
                                setTZMode('create');
                                setShowTZModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 btn btn--alt text-white rounded-3xl text-xs transition-colors"
                            title="Создать техническое задание"
                        >
                            <Plus size={14} />
                            Создать ТЗ
                        </button>
                    );
                }
            },
            {
                headerName: "Дата размещения",
                valueGetter: (p) => p.data?.sample.publish_date ?? "",
                width: 160,
                tooltipValueGetter: (p) => p.data?.sample.publish_date ?? "",
            },
        ];
    }, []);

    const onSelectionChanged = () => {
        const keys = gridRef.current?.api.getSelectedRows().map((r) => r.key) || [];
        setSelectionKeys(keys);
    };

    const del = useMutation({
        mutationFn: () => {
            const ids: string[] = [];
            for (const k of selectionKeys) {
                const g = byKey.get(k);
                if (!g) continue;
                for (const pid of g.projectIds) {
                    const id = g.perProject[pid];
                    if (id) ids.push(id);
                }
            }
            return cpDelete(ids);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["cp_flat"] });
            qc.invalidateQueries({ queryKey: ["cp_count"] });
            setSelectionKeys([]);
            setTick((t) => t + 1);
        },
    });

    const resetFilters = () => {
        setSearch("");
        setStatus("");
        setAuthor("");
        setReviewingDoctor("");
        setShowDoctorSuggestions(false);
        setPeriod("");
        setPeriodMonthUI("");
        setTick((t) => t + 1);
    };

    return (
        <div className="min-h-screen from-gray-50 via-white to-blue-50/30">
            <div className="p-6 space-y-6">
                {/* Заголовок */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-[var(--color-primary-hover)] text-white">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-all text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text">
                                Контент-план
                            </h1>
                            <p className="text-gray-500 mt-1">
                                Управление и планирование контента • Всего: {totalQ.data ?? "—"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowImport(true)}
                            className="flex items-center gap-2 btn-coffeeDark transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2
"
                        >
                            <Download className="w-4 h-4" />
                            Импорт
                        </button>

                        <button
                            onClick={() => setShowAdd(true)}
                            className="flex items-center gap-2 text-[var(--color-primary)] bg-transparent border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:text-[var(--color-whte)] transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2"
                        >
                            <Plus className="w-4 h-4" />
                            Добавить
                        </button>
                    </div>
                </div>

                {/* Статистические карточки */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Всего записей</p>
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
                                <p className="text-gray-500 text-sm font-medium">В работе</p>
                                <p className="text-2xl font-bold text-all mt-1">{statistics.inWork}</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-blue rounded-xl">
                                <Clock className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Можно размещать</p>
                                <p className="text-2xl font-bold text-all mt-1">{statistics.canPlace}</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-green rounded-xl">
                                <AlertTriangle className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Отправлено</p>
                                <p className="text-2xl font-bold text-all mt-1">{statistics.sent}</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-pink rounded-xl">
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Размещено</p>
                                <p className="text-2xl font-bold text-all mt-1">{statistics.placed}</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-purple rounded-xl">
                                <CheckCircle className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Панель фильтров */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl relative z-50">
                    <div className="space-y-6">
                        {/* Пресеты */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-gray-700">
                                <Wand2 className="w-5 h-5" />
                                <span className="text-sm font-medium">Быстрые фильтры:</span>
                            </div>
                            {presets.map((preset) => {
                                const Icon = preset.icon;
                                return (
                                    <button
                                        key={preset.name}
                                        onClick={preset.apply}
                                        className="flex items-center text-sm gap-2 bg-[var(--color-coffee)] text-[var(--color-coffee-text)] hover:bg-[#b8a99f] hover:text-[var(--color-whte)] transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2
"
                                    >
                                        <Icon className="w-4 h-4" />
                                        {preset.name}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Поиск и основные фильтры */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            {/* Поиск */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    placeholder="Поиск по теме, разделу, направлению..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            {/* Статус */}
                            <div className="relative z-50">
                                <Filter
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10"/>
                                <Select
                                    className="w-full pl-12"
                                    value={status}
                                    onChange={(v) => setStatus(v || "")}
                                    options={STATUS_OPTIONS.map((s) => ({label: s, value: s}))}
                                    placeholder="Все статусы"
                                />
                            </div>

                            {/* Период */}
                            <div className="relative">
                                <Calendar
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"/>
                                <input
                                    type="month"
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    value={periodMonthUI}
                                    onChange={(e) => {
                                        setPeriodMonthUI(e.target.value);
                                        const p = formatPeriodRuFromMonthInput(e.target.value);
                                        setPeriod(p || "");
                                    }}
                                />
                            </div>

                            {/* Автор */}
                            <div className="relative z-40">
                                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                                <UserSelect
                                    value={author}
                                    onChange={(v) => setAuthor(v || "")}
                                    placeholder="Все авторы"
                                    className="w-full pl-12"
                                />
                            </div>

                            {/* Фильтр по врачу с автокомплитом */}
                            <div className="relative z-30">
                                <Stethoscope className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-20" />
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    placeholder="Поиск по врачу..."
                                    value={reviewingDoctor}
                                    onChange={(e) => {
                                        setReviewingDoctor(e.target.value);
                                        setShowDoctorSuggestions(true);
                                    }}
                                    onFocus={() => setShowDoctorSuggestions(true)}
                                    onBlur={() => {
                                        // Задержка чтобы успел сработать клик по элементу списка
                                        setTimeout(() => setShowDoctorSuggestions(false), 200);
                                    }}
                                />

                                {/* Выпадающий список врачей */}
                                {showDoctorSuggestions && filteredDoctors.length > 0 && (
                                    <div
                                        className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-[var(--color-primary)]/20 rounded-xl shadow-xl max-h-48 overflow-y-auto"
                                        style={{ zIndex: 999999 }}
                                    >
                                        {filteredDoctors.map((doctor, index) => (
                                            <button
                                                key={index}
                                                className="w-full px-4 py-2 text-left focus:outline-none transition-colors text-sm cursor-pointer"
                                                onClick={() => {
                                                    setReviewingDoctor(doctor);
                                                    setShowDoctorSuggestions(false);
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'rgba(214, 0, 109, 0.1)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Stethoscope className="w-4 h-4 text-gray-400"/>
                                                    <span>{doctor}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Быстрые статусы и дополнительные кнопки */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {(["Можно размещать", "Отправлено на размещение", "Размещено"] as string[]).map(
                                    (s) => (
                                        <button
                                            key={s}
                                            className={`${status === s ? "ring-2 ring-blue-500 ring-offset-2" : ""} ${statusBadgeClasses(s)} cursor-pointer hover:shadow-md transition-all duration-200`}
                                            onClick={() => setStatus((prev) => (prev === s ? "" : s))}
                                        >
                                            {s}
                                            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/70 text-xs font-semibold">
                                                {statusCounters[s] ?? 0}
                                            </span>
                                        </button>
                                    )
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            const now = new Date();
                                            const y = now.getFullYear();
                                            const m = String(now.getMonth() + 1).padStart(2, "0");
                                            const ym = `${y}-${m}`;
                                            setPeriodMonthUI(ym);
                                            setPeriod(formatPeriodRuFromMonthInput(ym) || "");
                                        }}
                                        className="btn-coffeeDark text-sm transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2
"
                                    >
                                        Текущий
                                    </button>
                                    <button
                                        onClick={() => {
                                            const d = new Date();
                                            d.setMonth(d.getMonth() - 1);
                                            const y = d.getFullYear();
                                            const m = String(d.getMonth() + 1).padStart(2, "0");
                                            const ym = `${y}-${m}`;
                                            setPeriodMonthUI(ym);
                                            setPeriod(formatPeriodRuFromMonthInput(ym) || "");
                                        }}
                                        className="btn-coffeeDark text-sm transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2
"
                                    >
                                        Предыдущий
                                    </button>
                                </div>

                                <button
                                    onClick={() => setCompact((v) => !v)}
                                    className="flex items-center gap-2 btn-coffeeDark text-sm transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2
"
                                >
                                    {compact ? <Expand className="w-4 h-4" /> : <Shrink className="w-4 h-4" />}
                                    {compact ? "Расширить" : "Сжать"}
                                </button>

                                <button
                                    onClick={resetFilters}
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-3xl btn-pink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Сбросить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Таблица */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl relative z-10">
                    <div className="ag-theme-quartz rounded-2xl overflow-hidden border border-gray-200/50" style={{ height: 560 }}>
                        <AgGridReact<Grouped>
                            ref={gridRef}
                            rowSelection="multiple"
                            rowData={grouped}
                            columnDefs={cols}
                            onSelectionChanged={onSelectionChanged}
                            suppressRowClickSelection={true}
                            animateRows
                            suppressCellFocus
                            rowMultiSelectWithClick
                            headerHeight={40}
                            getRowId={(p) => p.data!.key}
                            context={gridContext}
                            rowHeight={compact ? 40 : 50}
                        />
                    </div>
                </div>

                {/* Панель управления выделением */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-gray-600">
                                <span className="font-medium">Строк:</span> {grouped.length} •
                                <span className="font-medium ml-2">Выбрано:</span> {selectionKeys.length}
                            </div>
                            {selectionKeys.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm text-blue-600 font-medium">
                                        {selectionKeys.length} элементов выбрано
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => gridRef.current?.api.selectAll()}
                                className="px-4 py-2 text-sm bg-[var(--color-coffee)] text-[var(--color-coffee-text)] hover:bg-[#b8a99f] hover:text-[var(--color-whte)] transition-colors duration-300 ease-in-out rounded-3xl"
                            >
                                Выделить всё
                            </button>
                            <button
                                onClick={() => gridRef.current?.api.deselectAll()}
                                className="text-sm bg-[var(--color-coffee)] text-[var(--color-coffee-text)] hover:bg-[#b8a99f] hover:text-[var(--color-whte)] transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2"
                            >
                                Снять выделение
                            </button>
                            <button
                                disabled={!selectionKeys.length}
                                onClick={() => {
                                    if (confirm("Удалить выбранные тексты во всех проектах?")) del.mutate();
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-3xl btn-pink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Удалить выбранные
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Модалки - оставляем как есть */}
            {showImport && (
                <ContentPlanImportModal
                    projects={projectsQ.data || []}
                    onClose={() => setShowImport(false)}
                    onImported={() => {
                        qc.invalidateQueries({ queryKey: ["cp_flat"] });
                        qc.invalidateQueries({ queryKey: ["cp_count"] });
                        setTick((t) => t + 1);
                    }}
                />
            )}

            {showAdd && (
                <ContentPlanAddModal
                    open={showAdd}
                    onClose={() => setShowAdd(false)}
                    onSaved={() => {
                        qc.invalidateQueries({ queryKey: ["cp_flat"] });
                        qc.invalidateQueries({ queryKey: ["cp_count"] });
                        setTick((t) => t + 1);
                    }}
                    projects={projectsQ.data || []}
                />
            )}

            <ContentPlanEditModal
                open={!!editGroup}
                item={editGroup?.sample ?? null}
                perProject={editGroup?.perProject}
                projectNames={Object.fromEntries((projectsQ.data || []).map((p) => [p.id, p.name]))}
                onClose={() => setEditGroup(null)}
                onSaved={() => {
                    setEditGroup(null);
                    qc.invalidateQueries({ queryKey: ["cp_flat"] });
                    qc.invalidateQueries({ queryKey: ["cp_count"] });
                    setTick((t) => t + 1);
                }}
            />

            <ContentPlanProjectsModal
                open={!!projectsGroup}
                onClose={() => setProjectsGroup(null)}
                onSaved={() => {
                    setProjectsGroup(null);
                    qc.invalidateQueries({ queryKey: ["cp_flat"] });
                    qc.invalidateQueries({ queryKey: ["cp_count"] });
                    setTick((t) => t + 1);
                }}
                item={
                    projectsGroup
                        ? {
                            sample: projectsGroup.sample,
                            projectIds: projectsGroup.projectIds,
                            perProject: projectsGroup.perProject,
                        }
                        : null
                }
                projects={projectsQ.data || []}
            />

            {/* Модалка ТЗ создание */}
            {showTZModal && (
                <TZCreateModal
                    open={showTZModal}
                    mode={tzMode}
                    contentPlanItem={tzMode === 'create' ? selectedContentPlanItem : undefined}
                    tzId={tzMode === 'edit' ? editingTZId : undefined}
                    onClose={() => {
                        setShowTZModal(false);
                        setSelectedContentPlanItem(null);
                        setEditingTZId(null);
                        qc.invalidateQueries({ queryKey: ["cp_flat"] });
                        qc.invalidateQueries({ queryKey: ["cp_count"] });
                        setTick((t) => t + 1);
                    }}
                    onSaved={() => {
                        setShowTZModal(false);
                        setSelectedContentPlanItem(null);
                        setEditingTZId(null);
                        qc.invalidateQueries({ queryKey: ["cp_flat"] });
                        qc.invalidateQueries({ queryKey: ["cp_count"] });
                        setTick((t) => t + 1);
                    }}
                />
            )}

            {/* Модалка просмотра ТЗ */}
            {showTZViewModal && selectedItem && selectedItem.technical_specification_id && (
                <TZViewModal
                    open={showTZViewModal}
                    tzId={selectedItem.technical_specification_id}
                    onClose={() => {
                        setShowTZViewModal(false);
                        setSelectedItem(null);
                    }}
                    onEdit={() => {
                        setShowTZViewModal(false);
                        setEditingTZId(selectedItem.technical_specification_id || null);
                        setSelectedContentPlanItem(selectedItem);
                        setTZMode('edit');
                        setShowTZModal(true);
                        setSelectedItem(null);
                    }}
                />
            )}
        </div>
    );
}
