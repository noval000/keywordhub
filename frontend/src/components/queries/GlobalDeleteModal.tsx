"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
    GlobalDeleteFilters,
    GlobalDeletePreview,
    globalDeletePreview,
    globalDeleteApply,
} from "@/lib/api";

type Props = {
    onClose: () => void;
    onDone: (deleted: number) => void; // вызовем после успеха
};

export default function GlobalDeleteModal({ onClose, onDone }: Props) {
    const [filters, setFilters] = useState<GlobalDeleteFilters>({});
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [preview, setPreview] = useState<GlobalDeletePreview | null>(null);
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [confirm, setConfirm] = useState("");

    const canApply = useMemo(
        () => preview && preview.total > 0 && selectedProjects.length > 0 && confirm.trim().toUpperCase() === "DELETE",
        [preview, selectedProjects, confirm]
    );

    async function runPreview() {
        setErr(null);
        setLoading(true);
        try {
            const data = await globalDeletePreview(filters);
            setPreview(data);
            setSelectedProjects([]); // сброс выбора
        } catch (e: any) {
            setErr(e?.response?.data?.detail || "Не удалось получить предпросмотр");
        } finally {
            setLoading(false);
        }
    }

    async function runApply() {
        if (!canApply) return;
        setErr(null);
        setLoading(true);
        try {
            const res = await globalDeleteApply({
                project_ids: selectedProjects,
                filters,
                confirm,
            });
            onDone(res?.deleted ?? 0);
            onClose();
        } catch (e: any) {
            setErr(e?.response?.data?.detail || "Не удалось удалить");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white w-[980px] max-h-[85vh] overflow-auto rounded-2xl shadow-lg">
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="font-semibold">Глобальное удаление запросов</div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800">✕</button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Фильтры */}
                    <div className="bg-slate-50 rounded-xl p-3">
                        <div className="font-medium mb-2">Фильтры (подстрочный поиск, ILIKE)</div>
                        <div className="grid md:grid-cols-3 gap-3">
                            <input
                                placeholder="Фраза содержит"
                                className="border rounded px-3 py-2"
                                value={filters.phrase_contains || ""}
                                onChange={e => setFilters(s => ({ ...s, phrase_contains: e.target.value || undefined }))}
                            />
                            <input
                                placeholder="Страница содержит"
                                className="border rounded px-3 py-2"
                                value={filters.page_contains || ""}
                                onChange={e => setFilters(s => ({ ...s, page_contains: e.target.value || undefined }))}
                            />
                            <input
                                placeholder="Тег содержит"
                                className="border rounded px-3 py-2"
                                value={filters.tag_contains || ""}
                                onChange={e => setFilters(s => ({ ...s, tag_contains: e.target.value || undefined }))}
                            />
                            <input
                                placeholder="Направление содержит"
                                className="border rounded px-3 py-2"
                                value={filters.direction_contains || ""}
                                onChange={e => setFilters(s => ({ ...s, direction_contains: e.target.value || undefined }))}
                            />
                            <input
                                placeholder="Кластер содержит"
                                className="border rounded px-3 py-2"
                                value={filters.cluster_contains || ""}
                                onChange={e => setFilters(s => ({ ...s, cluster_contains: e.target.value || undefined }))}
                            />
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    placeholder="WS от"
                                    className="border rounded px-3 py-2 w-full"
                                    value={filters.ws_min ?? ""}
                                    onChange={e =>
                                        setFilters(s => ({ ...s, ws_min: e.target.value === "" ? undefined : Number(e.target.value) }))
                                    }
                                />
                                <input
                                    type="number"
                                    placeholder="WS до"
                                    className="border rounded px-3 py-2 w-full"
                                    value={filters.ws_max ?? ""}
                                    onChange={e =>
                                        setFilters(s => ({ ...s, ws_max: e.target.value === "" ? undefined : Number(e.target.value) }))
                                    }
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-sm text-slate-600 w-20">Дата:</div>
                                <input
                                    type="date"
                                    className="border rounded px-3 py-2"
                                    value={filters.date_from || ""}
                                    onChange={e => setFilters(s => ({ ...s, date_from: e.target.value || undefined }))}
                                    title="c (YYYY-MM-DD)"
                                />
                                <span>—</span>
                                <input
                                    type="date"
                                    className="border rounded px-3 py-2"
                                    value={filters.date_to || ""}
                                    onChange={e => setFilters(s => ({ ...s, date_to: e.target.value || undefined }))}
                                    title="по (YYYY-MM-DD)"
                                />
                            </div>
                        </div>

                        <div className="mt-3">
                            <button
                                onClick={runPreview}
                                disabled={loading}
                                className={clsx("bg-slate-900 text-white rounded px-4 py-2", loading && "opacity-60")}
                            >
                                {loading ? "Ищем..." : "Показать совпадения"}
                            </button>
                        </div>
                    </div>

                    {/* Превью */}
                    {preview && (
                        <div className="bg-white border rounded-xl p-3">
                            <div className="flex items-center justify-between">
                                <div className="font-medium">Совпадений всего: {preview.total}</div>
                                <div className="text-sm text-slate-500">Отметьте проекты, где нужно удалить</div>
                            </div>
                            <div className="mt-2 max-h-64 overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-100">
                                    <tr>
                                        <th className="px-2 py-1 text-left">Выбрать</th>
                                        <th className="px-2 py-1 text-left">Проект</th>
                                        <th className="px-2 py-1 text-left">Совпадений</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {preview.per_project.map(row => (
                                        <tr key={row.project_id} className="odd:bg-white even:bg-slate-50">
                                            <td className="px-2 py-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProjects.includes(row.project_id)}
                                                    onChange={e => {
                                                        setSelectedProjects(prev =>
                                                            e.target.checked
                                                                ? [...new Set([...prev, row.project_id])]
                                                                : prev.filter(x => x !== row.project_id)
                                                        );
                                                    }}
                                                />
                                            </td>
                                            <td className="px-2 py-1">{row.project_name}</td>
                                            <td className="px-2 py-1">{row.count}</td>
                                        </tr>
                                    ))}
                                    {preview.per_project.length === 0 && (
                                        <tr>
                                            <td className="px-2 py-3" colSpan={3}>Совпадений нет</td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                                <input
                                    className="border rounded px-3 py-2"
                                    placeholder='Введите DELETE для подтверждения'
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                />
                                <button
                                    onClick={runApply}
                                    disabled={!canApply || loading}
                                    className={clsx(
                                        "rounded px-4 py-2",
                                        canApply ? "bg-red-600 text-white" : "bg-red-600/60 text-white"
                                    )}
                                >
                                    {loading ? "Удаляем..." : "Удалить отмеченные"}
                                </button>
                                <div className="text-xs text-slate-500">
                                    Удаление безвозвратно (история версий для DELETE не пишется).
                                </div>
                            </div>
                        </div>
                    )}

                    {err && <div className="text-red-600 text-sm">{err}</div>}
                </div>
            </div>
        </div>
    );
}
