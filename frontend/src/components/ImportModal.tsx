"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import clsx from "clsx";
import { api, importQueriesMulti } from "@/lib/api";
import { X, Upload, FileText, Download, AlertCircle, CheckCircle, Clock, Users, FileSpreadsheet, Eye, EyeOff, Target, Hash, Tag, Calendar, Globe } from 'lucide-react';

/** --- Типы --- */
type ParsedRow = Record<string, any>;

type ProjectDto = {
    id: string;
    name: string;
    domain?: string | null;
};

type Props = {
    projectId?: string;
    onClose: () => void;
    onImported: (count: number) => void; // получит реальное число загруженных строк
    directions?: string[];
    clusters?: string[];
};

/** --- Авто-распознавание заголовков --- */
const KNOWN_HEADERS = {
    phrase: ["Фраза", "Ключ", "Запрос", "Фразы", "Keyword"],
    direction: ["Направление", "Лист", "Sheet", "Direction"],
    cluster: ["Кластер", "Cluster", "Группа"],
    page: ["Страница", "URL", "Page", "Link"],
    tags: ["Теги", "Tags", "labels"],
    page_type: ["Тип страницы", "Page type"],
    query_type: ["Тип запроса", "Query type", "Intent"],
    ws_flag: ["WS", "[!WS]", "ws", "is_ws"],
    date: ["Дата", "Date", "dt"],
};

/** --- API-хелпер --- */
async function fetchProjects(): Promise<ProjectDto[]> {
    const r = await api.get("/projects");
    return r.data ?? [];
}

/** --- Парсер Wordstat --- */
function parseWs(val: any): number {
    if (val == null) return 0;
    const s = String(val).trim().toLowerCase();
    if (["true", "t", "yes", "y", "да", "+"].includes(s)) return 1;
    if (["false", "f", "no", "n", "нет", "-"].includes(s)) return 0;
    const clean = s.replace(/\s+/g, "").replace(/,/g, "");
    const n = Number(clean);
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
    return 0;
}

/** Считаем реальное число загруженных строк из ответа бэка */
function countFromResponse(
    res: any,
    itemsCount: number,
    projectCount: number
): number {
    const d = res?.data ?? {};
    if (typeof d.created === "number" || typeof d.updated === "number") {
        return (Number(d.created || 0) + Number(d.updated || 0)) | 0;
    }
    if (typeof d.inserted_or_updated === "number") {
        return Number(d.inserted_or_updated) | 0;
    }
    return itemsCount * projectCount;
}

export default function ImportModal({
                                        projectId,
                                        onClose,
                                        onImported,
                                        directions = [],
                                        clusters = [],
                                    }: Props) {
    /** Данные проектов (мультивыбор) */
    const [projects, setProjects] = useState<ProjectDto[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<string[]>(
        projectId ? [projectId] : []
    );

    /** Файл / парсинг */
    const [fileName, setFileName] = useState<string>("");
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [defDirection, setDefDirection] = useState("");
    const [defCluster, setDefCluster] = useState("");
    const [defQueryType, setDefQueryType] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    /** Частичный импорт (207) */
    const [missingByProject, setMissingByProject] = useState<
        Record<string, string[]>
    >({});
    const [allowedProjectIds, setAllowedProjectIds] = useState<string[] | null>(
        null
    );

    /** checkbox "Выделить все" (indeterminate) */
    const allToggleRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const total = projects.length;
        const sel = selectedProjects.length;
        const el = allToggleRef.current;
        if (!el) return;
        el.indeterminate = sel > 0 && sel < total;
    }, [projects.length, selectedProjects.length]);

    useEffect(() => {
        fetchProjects().then(setProjects).catch(() => setProjects([]));
    }, []);

    function guessMap(hdrs: string[]) {
        const map: Record<string, string> = {};
        const lower = hdrs.map((h) => h.trim());
        const take = (key: string, candidates: string[]) => {
            for (const c of candidates) {
                const i = lower.findIndex((h) => h.toLowerCase() === c.toLowerCase());
                if (i >= 0) {
                    map[key] = hdrs[i];
                    break;
                }
            }
        };
        take("phrase", KNOWN_HEADERS.phrase);
        take("direction", KNOWN_HEADERS.direction);
        take("cluster", KNOWN_HEADERS.cluster);
        take("page", KNOWN_HEADERS.page);
        take("tags", KNOWN_HEADERS.tags);
        take("page_type", KNOWN_HEADERS.page_type);
        take("query_type", KNOWN_HEADERS.query_type);
        take("ws_flag", KNOWN_HEADERS.ws_flag);
        take("date", KNOWN_HEADERS.date);
        return map;
    }

    const onFiles = async (f: FileList | null) => {
        if (!f?.length) return;
        const file = f[0];
        setFileName(file.name);
        setErr(null);
        const ext = file.name.split(".").pop()?.toLowerCase();

        const parseCsv = () =>
            new Promise<void>((resolve, reject) => {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: "greedy",
                    complete: (res) => {
                        const data = (res.data as any[]).map((r) =>
                            Object.fromEntries(
                                Object.entries(r).map(([k, v]) => [
                                    String(k).trim(),
                                    typeof v === "string" ? v.trim() : v,
                                ])
                            )
                        );
                        setRows(data);
                        const hdrs =
                            res.meta.fields?.map((h) => String(h).trim()) ||
                            Object.keys(data[0] || {});
                        setHeaders(hdrs);
                        setMapping(guessMap(hdrs));
                        resolve();
                    },
                    error: (e) => reject(e),
                });
            });

        const parseXlsx = async () => {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false }) as any[];
            const data = json.map((r) => {
                const obj: any = {};
                Object.keys(r).forEach(
                    (k) => (obj[String(k).trim()] = typeof r[k] === "string" ? r[k].trim() : r[k])
                );
                return obj;
            });
            setRows(data);
            const hdrs = Object.keys(data[0] || {});
            setHeaders(hdrs);
            setMapping(guessMap(hdrs));
        };

        try {
            if (ext === "csv") await parseCsv();
            else if (ext === "xlsx" || ext === "xls") await parseXlsx();
            else {
                await parseCsv();
            }
        } catch (e: any) {
            setErr(e?.message || "Не удалось разобрать файл");
        }
    };

    const preview = useMemo(() => rows.slice(0, 50), [rows]);

    /** Сборка элементов импорта */
    const buildItems = () => {
        const m = mapping;
        return rows
            .map((r) => {
                const rawTags = m.tags ? r[m.tags] ?? "" : "";
                const tags = Array.isArray(rawTags)
                    ? rawTags
                    : String(rawTags || "")
                        .split(/[;,]/)
                        .map((x: string) => x.trim())
                        .filter(Boolean);

                const wsRaw = m.ws_flag ? r[m.ws_flag] : "";
                const ws_flag = parseWs(wsRaw);

                const dateVal = m.date ? (r[m.date] || "").toString().trim() : "";
                let dateIso: string | undefined = undefined;
                if (dateVal) {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) dateIso = dateVal;
                    else if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateVal)) {
                        const [d, mth, y] = dateVal.split(".");
                        dateIso = `${y}-${mth}-${d}`;
                    }
                }

                const item: any = {
                    phrase: (m.phrase ? r[m.phrase] : "").toString().trim(),
                    direction: m.direction ? r[m.direction] : undefined,
                    cluster: m.cluster ? r[m.cluster] : undefined,
                    page: m.page ? r[m.page] : undefined,
                    tags,
                    page_type: m.page_type ? r[m.page_type] : undefined,
                    query_type: m.query_type ? r[m.query_type] : undefined,
                    ws_flag,
                };
                if (dateIso) item.date = dateIso;

                return item;
            })
            .filter((it) => it.phrase);
    };

    const itemsCount = useMemo(() => buildItems().length, [rows, mapping]);

    /** Основной импорт */
    const doImport = async (projectIds: string[]) => {
        const items = buildItems();
        const payload = {
            project_ids: projectIds,
            default_direction: defDirection || undefined,
            default_cluster: defCluster || undefined,
            default_query_type: defQueryType || undefined,
            items,
        };
        const res = await importQueriesMulti(payload);
        return res;
    };

    /** Отправка: мульти-импорт */
    const onImport = async () => {
        const items = buildItems();
        if (!items.length) {
            setErr("Нет валидных строк (нужна колонка с фразами)");
            return;
        }
        if (selectedProjects.length === 0) {
            setErr("Выберите хотя бы один проект");
            return;
        }

        setLoading(true);
        setErr(null);
        setMissingByProject({});
        setAllowedProjectIds(null);

        try {
            const res = await doImport(selectedProjects);

            // 207 — частичный успех: есть проекты с отсутствующими кластерами
            if (res.status === 207 && res.data?.missing_by_project) {
                const missing = res.data.missing_by_project as Record<string, string[]>;
                setMissingByProject(missing);
                const allowed =
                    res.data.allowed_project_ids ??
                    selectedProjects.filter((pid) => !(missing[pid]?.length));
                setAllowedProjectIds(allowed);
                return; // ждём решения пользователя
            }

            // 200 — обычный успех
            const count = countFromResponse(res, items.length, selectedProjects.length);
            onImported(count);
            onClose();
        } catch (e: any) {
            const det = e?.response?.data?.detail;
            if (det?.code === "cluster_registry_missing") {
                setErr(
                    `В реестре нет кластеров: ${det.missing.join(
                        ", "
                    )}. Открой «Реестр кластеров» и добавь их, или убери их из файла импорта.`
                );
            } else if (det?.code === "clusters_missing_by_project") {
                setMissingByProject(det.missing_by_project || {});
                setAllowedProjectIds(
                    selectedProjects.filter((pid) => !(det.missing_by_project?.[pid]?.length))
                );
            } else {
                setErr(e?.response?.data?.detail || "Ошибка импорта");
            }
        } finally {
            setLoading(false);
        }
    };

    /** Повторить импорт только в доступные проекты */
    const onImportAllowedOnly = async () => {
        if (!allowedProjectIds || allowedProjectIds.length === 0) {
            setErr("Нет проектов, в которые можно импортировать");
            return;
        }
        setLoading(true);
        setErr(null);
        try {
            const res = await doImport(allowedProjectIds);
            const count = countFromResponse(res, buildItems().length, allowedProjectIds.length);
            onImported(count);
            onClose();
        } catch (e: any) {
            setErr(e?.response?.data?.detail || "Ошибка импорта");
        } finally {
            setLoading(false);
        }
    };

    /** Выделить все / снять все */
    const toggleSelectAll = (checked: boolean) => {
        if (checked) setSelectedProjects(projects.map((p) => p.id));
        else setSelectedProjects([]);
    };

    const downloadTemplate = () => {
        const templateData = [
            ['Фраза', 'Направление', 'Кластер', 'Страница', 'Теги', 'Тип страницы', 'Тип запроса', 'WS', 'Дата'],
            ['пример запроса', 'Услуги', 'Диагностика', 'https://example.com', 'тег1,тег2', 'commercial', 'transactional', '1000', '2024-01-15']
        ];

        const ws = XLSX.utils.aoa_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
        XLSX.writeFile(wb, 'template_import.xlsx');
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
                {/* Header с градиентом */}
                <div className="bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 p-6 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20"></div>
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                <Upload className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Импорт CSV/Excel</h3>
                                <p className="text-green-100 text-sm">Загрузка данных в проекты</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-sm"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto space-y-6">
                    {/* Выбор проектов */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                        <div className="flex items-center space-x-3 mb-4">
                            <Users className="w-5 h-5 text-blue-600" />
                            <h4 className="font-semibold text-gray-800">В какие проекты грузить:</h4>
                        </div>

                        {/* Кнопка "Выделить все" */}
                        <div className="flex items-center gap-3 mb-4">
                            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                                <input
                                    ref={allToggleRef}
                                    type="checkbox"
                                    checked={projects.length > 0 && selectedProjects.length === projects.length}
                                    onChange={(e) => toggleSelectAll(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span>Выделить все</span>
                            </label>
                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-lg">
                                Выбрано: {selectedProjects.length} из {projects.length}
                            </span>
                        </div>

                        <div className="max-h-36 overflow-auto bg-white rounded-xl p-3 border border-blue-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {projects.map((p) => (
                                    <label key={p.id} className="flex items-center gap-3 text-sm py-2 px-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedProjects.includes(p.id)}
                                            onChange={(e) => {
                                                setSelectedProjects((s) =>
                                                    e.target.checked ? [...new Set([...s, p.id])] : s.filter((x) => x !== p.id)
                                                );
                                            }}
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex items-center space-x-2 flex-1">
                                            <span className="font-medium text-gray-800">{p.name}</span>
                                            {p.domain && (
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                    {p.domain}
                                                </span>
                                            )}
                                        </div>
                                    </label>
                                ))}
                                {projects.length === 0 && (
                                    <div className="text-sm text-gray-500 text-center py-4">Проекты не найдены</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Загрузка файла + шаблон */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Drag & Drop Zone */}
                        <div className="lg:col-span-2">
                            <label className="border-2 border-dashed border-green-300 rounded-2xl p-8 text-center cursor-pointer block hover:bg-green-50/50 hover:border-green-400 transition-all duration-300">
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    className="hidden"
                                    onChange={(e) => onFiles(e.target.files)}
                                />
                                <div className="flex flex-col items-center space-y-4">
                                    <div className="p-4 bg-green-100 rounded-2xl">
                                        <Upload className="w-8 h-8 text-green-600" />
                                    </div>
                                    {fileName ? (
                                        <div className="space-y-2">
                                            <p className="text-lg font-semibold text-gray-700">Файл загружен</p>
                                            <p className="text-sm text-green-600 font-medium">{fileName}</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-lg font-semibold text-gray-700 mb-1">
                                                Перетащите файл сюда
                                            </p>
                                            <p className="text-gray-500 text-sm">
                                                или нажмите для выбора CSV/XLSX файла
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </label>
                        </div>

                        {/* Скачать шаблон */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                            <div className="flex flex-col items-center space-y-4 h-full justify-center">
                                <div className="p-3 bg-blue-100 rounded-xl">
                                    <Download className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="text-center">
                                    <h4 className="font-semibold text-gray-800 mb-1">Шаблон для импорта</h4>
                                    <p className="text-gray-600 text-sm mb-3">
                                        Скачайте пример файла с правильной структурой
                                    </p>
                                    <button
                                        onClick={downloadTemplate}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors text-sm"
                                    >
                                        Скачать шаблон
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Дефолтные значения */}
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                        <h4 className="font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                            <Target className="w-5 h-5 text-gray-600" />
                            <span>Значения по умолчанию</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    list="directions"
                                    value={defDirection}
                                    onChange={(e) => setDefDirection(e.target.value)}
                                    placeholder="Дефолтное направление"
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200"
                                />
                                <datalist id="directions">
                                    {directions.map((d) => (
                                        <option key={d} value={d} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    list="clusters"
                                    value={defCluster}
                                    onChange={(e) => setDefCluster(e.target.value)}
                                    placeholder="Дефолтный кластер"
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200"
                                />
                                <datalist id="clusters">
                                    {clusters.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    value={defQueryType}
                                    onChange={(e) => setDefQueryType(e.target.value)}
                                    placeholder="Дефолтный тип запроса"
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Сопоставление колонок */}
                    {headers.length > 0 && (
                        <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200">
                            <div className="flex items-center space-x-3 mb-4">
                                <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                                <h4 className="font-semibold text-gray-800">Сопоставление колонок</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    ["phrase", "Фраза*"],
                                    ["direction", "Направление"],
                                    ["cluster", "Кластер"],
                                    ["page", "Страница"],
                                    ["tags", "Теги (через , или ;)"],
                                    ["page_type", "Тип страницы"],
                                    ["query_type", "Тип запроса"],
                                    ["ws_flag", "WS"],
                                    ["date", "Дата (YYYY-MM-DD или ДД.ММ.ГГГГ)"],
                                ].map(([key, label]) => (
                                    <div key={key} className="space-y-1">
                                        <div className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                                            <span>{label}</span>
                                            {key === 'phrase' && (
                                                <span className="text-red-500">*</span>
                                            )}
                                        </div>
                                        <select
                                            className="w-full p-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200"
                                            value={mapping[key] || ""}
                                            onChange={(e) =>
                                                setMapping((m) => ({ ...m, [key]: e.target.value || undefined }))
                                            }
                                        >
                                            <option value="">— нет —</option>
                                            {headers.map((h) => (
                                                <option key={h} value={h}>
                                                    {h}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Предпросмотр + статистика */}
                    {preview.length > 0 && (
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <Eye className="w-5 h-5 text-gray-600" />
                                    <h4 className="font-semibold text-gray-800">Предпросмотр данных</h4>
                                </div>
                                <button
                                    onClick={() => setShowPreview(!showPreview)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                                >
                                    {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    <span>{showPreview ? 'Скрыть' : 'Показать'} таблицу</span>
                                </button>
                            </div>

                            {/* Статистика */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div className="bg-white rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center space-x-3">
                                        <FileText className="w-8 h-8 text-blue-600" />
                                        <div>
                                            <p className="text-2xl font-bold text-gray-900">{itemsCount}</p>
                                            <p className="text-gray-600 text-sm">Строк в файле</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center space-x-3">
                                        <Users className="w-8 h-8 text-green-600" />
                                        <div>
                                            <p className="text-2xl font-bold text-gray-900">{selectedProjects.length}</p>
                                            <p className="text-gray-600 text-sm">Проектов выбрано</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center space-x-3">
                                        <Target className="w-8 h-8 text-purple-600" />
                                        <div>
                                            <p className="text-2xl font-bold text-gray-900">
                                                {itemsCount * Math.max(1, selectedProjects.length)}
                                            </p>
                                            <p className="text-gray-600 text-sm">Будет отправлено записей</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {showPreview && (
                                <div className="bg-white rounded-xl p-4 border border-gray-200">
                                    <div className="overflow-auto max-h-64">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                {headers.map((h) => (
                                                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {rows.slice(0, 50).map((r, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    {headers.map((h) => (
                                                        <td key={h} className="px-3 py-2 border-b border-gray-200">
                                                            {String(r[h] ?? "")}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-center text-gray-500 text-xs mt-2">
                                        Показаны первые 50 строк из {rows.length}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Ошибки */}
                    {err && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <div className="flex items-center space-x-2">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                <span className="text-red-800 text-sm">{err}</span>
                            </div>
                        </div>
                    )}

                    {/* Частичный импорт (207) */}
                    {allowedProjectIds && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                            <div className="flex items-center space-x-3 mb-4">
                                <AlertCircle className="w-5 h-5 text-amber-600" />
                                <h4 className="font-semibold text-amber-800">
                                    Не все проекты прошли проверку реестра кластеров
                                </h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <div className="text-sm text-amber-700 font-medium mb-2">
                                        Можно импортировать сейчас:
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-amber-200">
                                        {allowedProjectIds.length ? (
                                            <ul className="space-y-1">
                                                {allowedProjectIds.map((pid) => {
                                                    const p = projects.find((x) => x.id === pid);
                                                    return (
                                                        <li key={pid} className="flex items-center space-x-2">
                                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                                            <span className="text-sm">{p?.name || pid}</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-gray-500">— нет —</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-amber-700 font-medium mb-2">
                                        Заблокированы — добавьте кластеры в «Реестр»:
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-amber-200">
                                        <ul className="space-y-2">
                                            {Object.entries(missingByProject).map(([pid, miss]) => {
                                                if (!miss?.length) return null;
                                                const p = projects.find((x) => x.id === pid);
                                                return (
                                                    <li key={pid} className="text-sm">
                                                        <div className="font-medium text-gray-800">{p?.name || pid}:</div>
                                                        <div className="text-red-600 text-xs">{miss.join("; ")}</div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between mt-6">
                                <button
                                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                                    onClick={() => {
                                        setMissingByProject({});
                                        setAllowedProjectIds(null);
                                    }}
                                >
                                    Отмена
                                </button>
                                <button
                                    className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                    onClick={onImportAllowedOnly}
                                    disabled={loading || !allowedProjectIds.length}
                                >
                                    {loading && <Clock className="w-4 h-4 animate-spin" />}
                                    <span>{loading ? "Импорт..." : "Импортировать только в доступные"}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Кнопки */}
                    <div className="flex justify-between pt-4 border-t border-gray-100">
                        <button
                            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                            onClick={onClose}
                        >
                            Отмена
                        </button>
                        <button
                            disabled={!rows.length || loading || !mapping.phrase || selectedProjects.length === 0}
                            onClick={onImport}
                            className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            {loading && <Clock className="w-4 h-4 animate-spin" />}
                            <span>{loading ? "Импорт..." : "Импортировать"}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}