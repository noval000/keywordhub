"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listClusterRegistry, upsertClusterRegistryRow, updateClusterRegistryRow,
    deleteClusterRegistryRow, fetchProjects
} from "@/lib/api";
import { api } from "@/lib/api";

export default function ClusterRegistryPage() {
    const qc = useQueryClient();
    const [projectId, setProjectId] = useState<string>("");

    // 🔎 фильтры
    const [q, setQ] = useState("");                       // поиск по названию кластера (contains)
    const [dirs, setDirs] = useState<string[]>([]);       // выбранные направления (мульти)
    const [types, setTypes] = useState<string[]>([]);     // выбранные типы страниц (мульти)

    const projects = useQuery({
        queryKey: ["projects", { archived: false }],
        queryFn: () => fetchProjects({ archived: false })
    });

    const reg = useQuery({
        queryKey: ["cluster_registry", projectId],
        queryFn: () => projectId ? listClusterRegistry(projectId) : Promise.resolve([]),
    });

    const add = useMutation({
        mutationFn: (row: any) => upsertClusterRegistryRow(row),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["cluster_registry", projectId] }),
    });
    const patch = useMutation({
        mutationFn: ({ id, patch }: any) => updateClusterRegistryRow(id, patch),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["cluster_registry", projectId] }),
    });
    const del = useMutation({
        mutationFn: (id: string) => deleteClusterRegistryRow(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["cluster_registry", projectId] }),
    });

    // опции для мультиселектов (уникальные значения из данных)
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

    // клиентская фильтрация
    const filtered = useMemo(() => {
        const data = reg.data || [];
        const needle = q.trim().toLowerCase();

        return data.filter((r: any) => {
            // по названию
            const okName = !needle || (r.name || "").toLowerCase().includes(needle);
            // по направлению
            const okDir = dirs.length === 0 || (r.direction && dirs.includes(r.direction));
            // по типу страницы
            const okType = types.length === 0 || (r.page_type && types.includes(r.page_type));
            return okName && okDir && okType;
        });
    }, [reg.data, q, dirs, types]);

    // CSV импорт
    const [csvUploading, setCsvUploading] = useState(false);
    const [csvResult, setCsvResult] = useState<null | { processed:number; created:number; updated:number; errors:string[] }>(null);
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

    // вспомогательно: чтение опций из <select multiple>
    const readMulti = (sel: HTMLSelectElement): string[] =>
        Array.from(sel.selectedOptions).map(o => o.value);

    const resetFilters = () => {
        setQ("");
        setDirs([]);
        setTypes([]);
    };

    const hasActiveFilters = q || dirs.length || types.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Заголовок страницы */}
                <div className="text-center py-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-800">Реестр кластеров</h1>
                    </div>
                    <p className="text-slate-600 max-w-2xl mx-auto">
                        Управляйте кластерами, направлениями и структурой данных ваших проектов
                    </p>
                </div>

                {/* Выбор проекта */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200/50 p-8">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    Выберите проект
                                </label>
                                <div className="text-xs text-slate-500">Активный проект для работы с реестром</div>
                            </div>
                        </div>
                        <div className="relative flex-1 max-w-md">
                            <select
                                className="w-full border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-3 text-base bg-white transition-all appearance-none pr-10"
                                value={projectId}
                                onChange={e => setProjectId(e.target.value)}
                            >
                                <option value="">— Выберите проект —</option>
                                {(projects.data || []).map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {projectId && (
                    <>
                        {/* Фильтры и поиск */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/50 p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800">Фильтры и поиск</h3>
                                {hasActiveFilters && (
                                    <div className="ml-auto">
                                        <button
                                            type="button"
                                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                                            onClick={resetFilters}
                                        >
                                            Сбросить все фильтры
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Поиск */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Поиск по кластеру
                                    </label>
                                    <div className="relative">
                                        <input
                                            value={q}
                                            onChange={e => setQ(e.target.value)}
                                            placeholder="Введите название кластера..."
                                            className="w-full border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-3 pl-10 text-base transition-all"
                                        />
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                        {q && (
                                            <button
                                                onClick={() => setQ("")}
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Направления */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Направления ({dirs.length} выбрано)
                                    </label>
                                    <div className="relative">
                                        <select
                                            multiple
                                            size={Math.min(6, Math.max(3, dirOptions.length))}
                                            className="w-full border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm transition-all bg-white"
                                            value={dirs}
                                            onChange={(e) => setDirs(readMulti(e.target))}
                                        >
                                            {dirOptions.length === 0 && (
                                                <option disabled className="text-slate-400">Нет направлений</option>
                                            )}
                                            {dirOptions.map((d) => (
                                                <option key={d} value={d} className="py-1">{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Типы страниц */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Типы страниц ({types.length} выбрано)
                                    </label>
                                    <div className="relative">
                                        <select
                                            multiple
                                            size={Math.min(6, Math.max(3, typeOptions.length))}
                                            className="w-full border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm transition-all bg-white"
                                            value={types}
                                            onChange={(e) => setTypes(readMulti(e.target))}
                                        >
                                            {typeOptions.length === 0 && (
                                                <option disabled className="text-slate-400">Нет типов страниц</option>
                                            )}
                                            {typeOptions.map((t) => (
                                                <option key={t} value={t} className="py-1">{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Импорт CSV и статистика */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/50 p-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-800 cursor-pointer">
                                            {csvUploading ? "Импортируем..." : "Импорт CSV файла"}
                                            <input
                                                type="file"
                                                accept=".csv"
                                                className="hidden"
                                                onChange={(e) => onCsvUpload(e.target.files?.[0] || null)}
                                                disabled={csvUploading}
                                            />
                                        </label>
                                        <div className="text-sm text-slate-500">Загрузите CSV файл для массового импорта</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 text-sm">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-indigo-600">{filtered.length}</div>
                                        <div className="text-slate-500">Показано</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-slate-600">{reg.data?.length ?? 0}</div>
                                        <div className="text-slate-500">Всего</div>
                                    </div>
                                </div>
                            </div>

                            {csvResult && (
                                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                                    <div className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
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

                        {/* Таблица данных */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
                            <div className="p-8 border-b border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-800">Данные реестра</h3>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                {/* Заголовки таблицы */}
                                <div className="grid grid-cols-8 gap-4 px-8 py-4 bg-slate-50 text-sm font-semibold text-slate-600 border-b border-slate-200">
                                    <div>Кластер</div>
                                    <div>Направление</div>
                                    <div>Тип страницы</div>
                                    <div className="text-center">Ядро</div>
                                    <div className="text-center">ТЗ</div>
                                    <div className="text-center">Размещено</div>
                                    <div className="text-center">Спрос</div>
                                    <div className="text-center">Действия</div>
                                </div>

                                {/* Строки данных */}
                                <div className="divide-y divide-slate-100">
                                    {filtered.map((r: any, index: number) => (
                                        <div key={r.id} className={`grid grid-cols-8 gap-4 px-8 py-4 items-center hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-25'}`}>
                                            <div className="font-medium text-slate-800 truncate" title={r.name}>{r.name}</div>
                                            <input
                                                defaultValue={r.direction || ""}
                                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                                placeholder="Направление"
                                                onBlur={e => patch.mutate({ id: r.id, patch: { direction: e.target.value || null } })}
                                            />
                                            <input
                                                defaultValue={r.page_type || ""}
                                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                                placeholder="Тип страницы"
                                                onBlur={e => patch.mutate({ id: r.id, patch: { page_type: e.target.value || null } })}
                                            />
                                            <div className="flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    defaultChecked={r.has_core}
                                                    className="w-4 h-4 accent-indigo-600 rounded"
                                                    onChange={e => patch.mutate({ id: r.id, patch: { has_core: e.target.checked } })}
                                                />
                                            </div>
                                            <div className="flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    defaultChecked={r.has_brief}
                                                    className="w-4 h-4 accent-indigo-600 rounded"
                                                    onChange={e => patch.mutate({ id: r.id, patch: { has_brief: e.target.checked } })}
                                                />
                                            </div>
                                            <div className="flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    defaultChecked={r.is_published}
                                                    className="w-4 h-4 accent-green-600 rounded"
                                                    onChange={e => patch.mutate({ id: r.id, patch: { is_published: e.target.checked } })}
                                                />
                                            </div>
                                            <input
                                                type="number"
                                                defaultValue={r.demand}
                                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-20 text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                                min="0"
                                                onBlur={e => patch.mutate({ id: r.id, patch: { demand: Number(e.target.value || 0) } })}
                                            />
                                            <div className="flex justify-center">
                                                <button
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                                                    onClick={() => del.mutate(r.id)}
                                                    title="Удалить запись"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {filtered.length === 0 && (
                                    <div className="text-center py-12 text-slate-400">
                                        <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        <div className="text-lg font-medium mb-1">
                                            {hasActiveFilters ? "Ничего не найдено" : "Реестр пуст"}
                                        </div>
                                        <div className="text-sm">
                                            {hasActiveFilters ? "Попробуйте изменить параметры поиска" : "Добавьте первый кластер в реестр"}
                                        </div>
                                    </div>
                                )}

                                {/* Форма добавления */}
                                <div className="border-t-2 border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                                    <div className="px-8 py-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                                                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                </svg>
                                            </div>
                                            <h4 className="font-semibold text-slate-800">Добавить новый кластер</h4>
                                        </div>
                                        <AddForm onAdd={(row) => add.mutate({ ...row, project_id: projectId })} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {!projectId && (
                    <div className="text-center py-16">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">Выберите проект</h3>
                        <p className="text-slate-500">Для работы с реестром кластеров необходимо выбрать активный проект</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function AddForm({ onAdd }: { onAdd: (row: any) => void }) {
    const [name, setName] = useState("");
    const [direction, setDirection] = useState("");
    const [pageType, setPageType] = useState("");
    const [hasCore, setHasCore] = useState(false);
    const [hasBrief, setHasBrief] = useState(false);
    const [isPublished, setIsPublished] = useState(false);
    const [demand, setDemand] = useState<number>(0);

    const handleSubmit = () => {
        if (!name.trim()) return;

        onAdd({
            name: name.trim(),
            direction: direction.trim() || undefined,
            page_type: pageType.trim() || undefined,
            has_core: hasCore,
            has_brief: hasBrief,
            is_published: isPublished,
            demand
        });

        // Очищаем форму после добавления
        setName("");
        setDirection("");
        setPageType("");
        setHasCore(false);
        setHasBrief(false);
        setIsPublished(false);
        setDemand(0);
    };

    return (
        <div className="grid grid-cols-8 gap-4 items-center">
            <input
                placeholder="Название кластера *"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                value={name}
                onChange={e => setName(e.target.value)}
            />
            <input
                placeholder="Направление"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                value={direction}
                onChange={e => setDirection(e.target.value)}
            />
            <input
                placeholder="Тип страницы"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                value={pageType}
                onChange={e => setPageType(e.target.value)}
            />
            <div className="flex justify-center">
                <input
                    type="checkbox"
                    checked={hasCore}
                    onChange={e => setHasCore(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded"
                />
            </div>
            <div className="flex justify-center">
                <input
                    type="checkbox"
                    checked={hasBrief}
                    onChange={e => setHasBrief(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded"
                />
            </div>
            <div className="flex justify-center">
                <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={e => setIsPublished(e.target.checked)}
                    className="w-4 h-4 accent-green-600 rounded"
                />
            </div>
            <input
                type="number"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-20 text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                value={demand}
                onChange={e => setDemand(Number(e.target.value || 0))}
                min="0"
            />
            <button
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl px-4 py-2 font-semibold transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={handleSubmit}
                disabled={!name.trim()}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Добавить
            </button>
        </div>
    );
}
