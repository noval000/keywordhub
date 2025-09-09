"use client";

import { useEffect, useMemo, useState } from "react";
import { cpCreate, type CPItem, type ProjectDto } from "@/lib/api";
import Papa from "papaparse";
// @ts-ignore — опционально, если установлен
import * as XLSX from "xlsx";
import {
    Upload,
    X,
    FileSpreadsheet,
    Target,
    CheckSquare,
    Square,
    FileText,
    Calendar,
    Tag,
    Settings,
    AlertTriangle,
    CheckCircle2,
    Database,
    Eye,
} from "lucide-react";

type Props = {
    projects: ProjectDto[];
    onClose: () => void;
    onImported: () => void;
};

type RawRow = Record<string, any>;
type PreviewRow = {
    period?: string | null;
    section?: string | null;
    direction?: string | null;
    topic?: string | null;
    tz?: string | null;
    chars?: number | null;
    status?: string | null;
    author?: string | null;
    review?: string | null;
    meta_seo?: string | null;
    publish_allowed?: string | null; // ТЕКСТ или null
    comment?: string | null;
    link?: string | null;
    publish_date?: string | null;   // YYYY-MM-DD
};

function normalizeHeader(s: string) {
    const x = (s || "").toString().trim().toLowerCase();
    const c = x.replace(/\s+/g, " ");
    if (c === "период") return "period";
    if (c === "раздел") return "section";
    if (c === "направление") return "direction";
    if (c === "тема") return "topic";
    if (c === "тз" || c === "тз/бриф" || c === "тз бриф") return "tz";
    if (c === "символы" || c === "кол-во символов" || c === "количество символов") return "chars";
    if (c === "статус") return "status";
    if (c === "автор") return "author";
    if (c === "на проверке у врача" || c === "ссылка у врача" || c === "проверка" || c === "редактор") return "review";
    if (c === "meta seo" || c === "мета seo" || c === "мета") return "meta_seo";
    if (c === "можно размещать" || c === "к публикации") return "publish_allowed";
    if (c === "комментарий" || c === "комменты" || c === "коммент") return "comment";
    if (c === "ссылка" || c === "url") return "link";
    if (c === "дата размещения" || c === "дата публикации" || c === "дата") return "publish_date";
    return x;
}

function toInt(v: any): number | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === "") return null;
    const n = Number(s.replace(/\s+/g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : null;
}

function toDateISO(v: any): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === "") return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const m1 = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(s);
    if (m1) {
        const d = m1[1].padStart(2, "0");
        const mo = m1[2].padStart(2, "0");
        const y = m1[3];
        return `${y}-${mo}-${d}`;
    }

    // Excel serial date
    if (!isNaN(Number(s)) && Number(s) > 25569 && Number(s) < 60000) {
        const date = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(date.getUTCDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }
    return null;
}

const toNullIfEmpty = (v: any): string | null => {
    const s = v == null ? "" : String(v).trim();
    return s ? s : null;
};

function mapRawRow(r: RawRow): PreviewRow {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(r)) {
        const nk = normalizeHeader(k);
        obj[nk] = v;
    }

    return {
        period: toNullIfEmpty(obj["period"]),
        section: toNullIfEmpty(obj["section"]),
        direction: toNullIfEmpty(obj["direction"]),
        topic: toNullIfEmpty(obj["topic"]),
        tz: toNullIfEmpty(obj["tz"]),
        chars: toInt(obj["chars"]),
        status: toNullIfEmpty(obj["status"]),
        author: toNullIfEmpty(obj["author"]),
        review: toNullIfEmpty(obj["review"]),
        meta_seo: toNullIfEmpty(obj["meta_seo"]),
        publish_allowed: toNullIfEmpty(obj["publish_allowed"]), // <= пустые -> null
        comment: toNullIfEmpty(obj["comment"]),
        link: toNullIfEmpty(obj["link"]),
        publish_date: toDateISO(obj["publish_date"]),
    };
}

function normalizeUrlOrNull(v: string | null | undefined): string | null {
    const s = (v ?? "").trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
}

export default function ContentPlanImportModal({ projects, onClose, onImported }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [rows, setRows] = useState<PreviewRow[]>([]);
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const allChecked = useMemo(
        () => selectedProjectIds.length > 0 && selectedProjectIds.length === projects.length,
        [selectedProjectIds, projects.length]
    );

    const toggleAll = () => {
        if (allChecked) setSelectedProjectIds([]);
        else setSelectedProjectIds(projects.map((p) => p.id));
    };

    const toggleOne = (id: string) => {
        setSelectedProjectIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const previewColumns = useMemo(() => {
        const keys = new Set<string>();
        rows.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
        return Array.from(keys);
    }, [rows]);

    async function parseFile(f: File) {
        setError(null);
        const ext = f.name.toLowerCase();
        if (ext.endsWith(".csv")) {
            await new Promise<void>((resolve, reject) => {
                Papa.parse(f, {
                    header: true,
                    skipEmptyLines: "greedy",
                    complete: (res) => {
                        try {
                            const mapped = (res.data as RawRow[])
                                .map(mapRawRow)
                                .filter((r) => (r.topic ?? "").toString().trim().length);
                            setRows(mapped);
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    },
                    error: reject,
                });
            });
            return;
        }

        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sh = wb.Sheets[wb.SheetNames[0]];
        const json: RawRow[] = XLSX.utils.sheet_to_json(sh, { raw: false, defval: "" });
        const mapped = json
            .map(mapRawRow)
            .filter((r) => (r.topic ?? "").toString().trim().length);
        setRows(mapped);
    }

    async function handleImport() {
        setError(null);
        if (!rows.length) {
            setError("Нет строк для импорта.");
            return;
        }
        if (!selectedProjectIds.length) {
            setError("Выберите хотя бы один проект.");
            return;
        }

        setLoading(true);
        try {
            const tasks: Promise<any>[] = [];

            for (const pid of selectedProjectIds) {
                for (const r of rows) {
                    const item: Partial<CPItem> = {
                        period: r.period ?? null,
                        section: r.section ?? null,
                        direction: r.direction ?? null,
                        topic: r.topic ?? null,
                        tz: normalizeUrlOrNull(r.tz),
                        chars: r.chars ?? null,
                        status: r.status ?? null,
                        author: r.author ?? null,
                        review: normalizeUrlOrNull(r.review),
                        meta_seo: r.meta_seo ?? null,
                        // ВАЖНО: пустые -> null (никаких "")
                        publish_allowed: (r.publish_allowed && r.publish_allowed.trim()) ? r.publish_allowed.trim() : null,
                        comment: r.comment ?? null,
                        link: normalizeUrlOrNull(r.link),
                        publish_date: r.publish_date ?? null,
                    };

                    tasks.push(
                        cpCreate({ project_ids: [pid], item })
                    );
                }
            }

            const results = await Promise.allSettled(tasks);
            const rejected = results.filter(r => r.status === "rejected");
            if (rejected.length > 0) {
                setError(`Импорт завершён c ошибками: проблемных строк — ${rejected.length} из ${results.length}.`);
            }

            onImported();
            onClose();
        } catch (e: any) {
            setError(e?.message || "Ошибка при импорте");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {}, [projects]);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl w-[1000px] max-w-[95vw] max-h-[90vh] overflow-hidden border border-white/20 flex flex-col">
                {/* Заголовок */}
                <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100 flex items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white">
                            <Upload className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Импорт контент-плана</h2>
                    </div>
                    <button
                        className="ml-auto p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        onClick={onClose}
                        disabled={loading}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Содержимое */}
                <div className="p-6 space-y-6 overflow-auto flex-1">
                    {/* Ошибка */}
                    {error && (
                        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Выбор проектов */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                            <Target className="w-5 h-5 text-blue-600" />
                            Куда импортировать
                        </h3>

                        <div className="space-y-4">
                            <label className="inline-flex items-center gap-3 cursor-pointer">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={allChecked}
                                        onChange={toggleAll}
                                        className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded border-2 transition-colors ${
                                        allChecked
                                            ? 'bg-green-600 border-green-600'
                                            : 'border-gray-300 hover:border-gray-400'
                                    }`}>
                                        {allChecked && <CheckSquare className="w-5 h-5 text-white" />}
                                    </div>
                                </div>
                                <span className="font-medium text-gray-900">Выбрать все проекты</span>
                            </label>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {projects.map((p) => (
                                    <label
                                        key={p.id}
                                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={selectedProjectIds.includes(p.id)}
                                                onChange={() => toggleOne(p.id)}
                                                className="sr-only"
                                            />
                                            <div className={`w-4 h-4 rounded border-2 transition-colors ${
                                                selectedProjectIds.includes(p.id)
                                                    ? 'bg-green-600 border-green-600'
                                                    : 'border-gray-300'
                                            }`}>
                                                {selectedProjectIds.includes(p.id) && <CheckSquare className="w-4 h-4 text-white" />}
                                            </div>
                                        </div>
                                        <span className="text-sm text-gray-900 truncate">{p.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Выбор файла */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                            <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                            Выбор файла
                        </h3>

                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-gray-400 transition-colors">
                                <div className="text-center">
                                    <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl inline-block mb-3">
                                        <FileSpreadsheet className="w-8 h-8 text-purple-600" />
                                    </div>
                                    <div className="space-y-2">
                                        <input
                                            type="file"
                                            accept=".csv,.xlsx,.xls"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0] || null;
                                                setFile(f);
                                                if (f) parseFile(f);
                                            }}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 file:cursor-pointer cursor-pointer"
                                        />
                                        <p className="text-sm text-gray-500">Поддерживаются форматы: CSV, XLSX, XLS</p>
                                    </div>
                                </div>
                            </div>

                            {file && (
                                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                                    <FileText className="w-5 h-5 text-purple-600" />
                                    <span className="text-sm font-medium text-purple-900">{file.name}</span>
                                    <CheckCircle2 className="w-5 h-5 text-green-600 ml-auto" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Предпросмотр данных */}
                    {rows.length > 0 && (
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <Eye className="w-5 h-5 text-indigo-600" />
                                        Предпросмотр данных
                                    </h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Database className="w-4 h-4" />
                                        <span className="font-medium">{rows.length} строк</span>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-auto max-h-80">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700 border-b flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-blue-600" />
                                            Тема
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700 border-b flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-green-600" />
                                            Период
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700 border-b flex items-center gap-2">
                                            <Tag className="w-4 h-4 text-purple-600" />
                                            Раздел
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700 border-b flex items-center gap-2">
                                            <Settings className="w-4 h-4 text-orange-600" />
                                            Статус
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-700 border-b">
                                            Можно размещать
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {rows.slice(0, 200).map((r, i) => (
                                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3 border-b text-gray-900">{r.topic ?? "—"}</td>
                                            <td className="px-4 py-3 border-b text-gray-700">{r.period ?? "—"}</td>
                                            <td className="px-4 py-3 border-b text-gray-700">{r.section ?? "—"}</td>
                                            <td className="px-4 py-3 border-b">
                                                {r.status ? (
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium">
                                                            {r.status}
                                                        </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 border-b text-gray-700">{r.publish_allowed ?? "—"}</td>
                                        </tr>
                                    ))}
                                    {rows.length > 200 && (
                                        <tr>
                                            <td className="px-4 py-4 text-gray-500 italic text-center" colSpan={5}>
                                                Показаны первые 200 строк из {rows.length}
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Футер */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button
                        className="px-6 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Отмена
                    </button>
                    <button
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!rows.length || !selectedProjectIds.length || loading}
                        onClick={handleImport}
                    >
                        <Upload className="w-4 h-4" />
                        {loading ? "Импорт..." : "Импортировать"}
                    </button>
                </div>
            </div>
        </div>
    );
}