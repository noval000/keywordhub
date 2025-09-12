"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProjects, cpCreate, cpDelete, type CPItem, type ProjectDto } from "@/lib/api";
import '../../app/globals.css'
import {
    Link2,
    X,
    Target,
    CheckSquare,
    Square,
    FileText,
    Calendar,
    Save,
    FolderOpen,
    Hash,
    User,
    Tag,
} from "lucide-react";

type Props = {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    item: {
        sample: CPItem;
        projectIds: string[];
        perProject: Record<string, string>; // project_id -> item_id
    } | null;
    projects?: ProjectDto[]; // опционально можем передать список проектов снаружи
};

export default function ContentPlanProjectsModal({
                                                     open,
                                                     onClose,
                                                     onSaved,
                                                     item,
                                                     projects: extProjects = [],
                                                 }: Props) {
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState<Array<{ id: string; name: string }>>(
        extProjects.map((p) => ({ id: p.id, name: p.name }))
    );
    const [checked, setChecked] = useState<Record<string, boolean>>({});

    // Подгружаем проекты (если не передали снаружи)
    useEffect(() => {
        if (!open) return;
        (async () => {
            if (extProjects.length) {
                setProjects(extProjects.map((p) => ({ id: p.id, name: p.name })));
            } else {
                const list = await fetchProjects({ archived: false } as any);
                setProjects(list.map((p) => ({ id: p.id, name: p.name })));
            }
        })();
    }, [open, extProjects]);

    // Отмечаем галочки по текущим привязкам
    useEffect(() => {
        if (!open || !item || projects.length === 0) return;
        const next: Record<string, boolean> = {};
        for (const p of projects) next[p.id] = item.projectIds.includes(p.id);
        setChecked(next);
    }, [open, item, projects]);

    const allChecked = useMemo(
        () => projects.length > 0 && projects.every((p) => !!checked[p.id]),
        [projects, checked]
    );

    const toggleAll = () => {
        const next: Record<string, boolean> = {};
        const target = !allChecked;
        for (const p of projects) next[p.id] = target;
        setChecked(next);
    };

    const toggleOne = (pid: string) =>
        setChecked((prev) => ({ ...prev, [pid]: !prev[pid] }));

    if (!open || !item) return null;

    const onSave = async () => {
        setLoading(true);
        try {
            const want = new Set(
                Object.entries(checked)
                    .filter(([, v]) => v)
                    .map(([k]) => k)
            );
            const cur = new Set(item.projectIds);

            const toAdd = [...want].filter((pid) => !cur.has(pid));
            const toRemoveProjects = [...cur].filter((pid) => !want.has(pid));
            const toRemoveIds = toRemoveProjects
                .map((pid) => item.perProject[pid])
                .filter(Boolean) as string[];

            // Добавить в новые проекты — создаём копии через cpCreate
            if (toAdd.length) {
                const payload: Partial<CPItem> = {
                    period: item.sample.period ?? null,
                    section: item.sample.section ?? null,
                    direction: item.sample.direction ?? null,
                    topic: item.sample.topic ?? null,
                    tz: item.sample.tz ?? null,
                    chars: item.sample.chars ?? null,
                    status: item.sample.status ?? null,
                    author: item.sample.author ?? null,
                    review: item.sample.review ?? null,      // ссылка «на проверке у врача»
                    meta_seo: item.sample.meta_seo ?? null,
                    doctor_review: item.sample.doctor_review ?? null,
                    comment: item.sample.comment ?? null,
                    link: item.sample.link ?? null,
                    publish_date: item.sample.publish_date ?? null,
                };
                await cpCreate({ project_ids: toAdd, item: payload });
            }

            // Удалить из проектов, которые сняли
            if (toRemoveIds.length) {
                await cpDelete(toRemoveIds);
            }

            onSaved();    // родитель сам сделает refetch/закроет модалку
        } finally {
            setLoading(false);
        }
    };

    const selectedCount = Object.values(checked).filter(Boolean).length;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl w-[600px] max-w-[95vw] max-h-[90vh] overflow-hidden border border-white/20">
                {/* Заголовок */}
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100 flex items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-[var(--color-primary-hover)] text-white">
                            <Link2 className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Привязка к проектам</h2>
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
                <div className="p-6 space-y-6">
                    {/* Информация о элементе */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-[var(--color-primary-hover)]" />
                            Информация о контенте
                        </h3>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-sm text-gray-500 w-20">
                                    <Hash className="w-4 h-4" />
                                    <span>Тема:</span>
                                </div>
                                <span className="text-gray-900 font-medium">{item.sample.topic || "—"}</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-sm text-gray-500 w-20">
                                    <Calendar className="w-4 h-4" />
                                    <span>Период:</span>
                                </div>
                                <span className="text-gray-900">{item.sample.period || "—"}</span>
                            </div>

                            {item.sample.section && (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 text-sm text-gray-500 w-20">
                                        <Tag className="w-4 h-4" />
                                        <span>Раздел:</span>
                                    </div>
                                    <span className="text-gray-900">{item.sample.section}</span>
                                </div>
                            )}

                            {item.sample.author && (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 text-sm text-gray-500 w-20">
                                        <User className="w-4 h-4" />
                                        <span>Автор:</span>
                                    </div>
                                    <span className="text-gray-900">{item.sample.author}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Выбор проектов */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Target className="w-5 h-5 text-[var(--color-primary-hover)]" />
                                Выбор проектов
                            </h3>
                            <div className="text-sm text-gray-500">
                                Выбрано: <span className="font-medium text-indigo-600">{selectedCount}</span> из {projects.length}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Выбрать все */}
                            <div className="pb-3 border-b border-gray-100">
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
                                                ? 'bg-indigo-600 border-indigo-600'
                                                : 'border-gray-300 hover:border-gray-400'
                                        }`}>
                                            {allChecked && <CheckSquare className="w-5 h-5 text-white" />}
                                        </div>
                                    </div>
                                    <span className="font-medium text-gray-900">Выбрать все проекты</span>
                                </label>
                            </div>

                            {/* Список проектов */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                                {projects.map((p) => (
                                    <label
                                        key={p.id}
                                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="relative flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={!!checked[p.id]}
                                                onChange={() => toggleOne(p.id)}
                                                className="sr-only"
                                            />
                                            <div className={`w-4 h-4 rounded border-2 transition-colors ${
                                                checked[p.id]
                                                    ? 'bg-indigo-600 border-indigo-600'
                                                    : 'border-gray-300'
                                            }`}>
                                                {checked[p.id] && <CheckSquare className="w-4 h-4 text-white" />}
                                            </div>
                                        </div>
                                        <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        <span className="text-sm text-gray-900 truncate">{p.name}</span>
                                    </label>
                                ))}
                            </div>

                            {projects.length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <p>Проекты не найдены</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Футер */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button
                        className="btn-coffeeDark text-sm transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Отмена
                    </button>
                    <button
                        className="flex items-center gap-2 text-[var(--color-primary)] text-sm bg-transparent border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:text-[var(--color-whte)] transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                        onClick={onSave}
                    >
                        <Save className="w-4 h-4" />
                        {loading ? "Сохранение..." : "Сохранить изменения"}
                    </button>
                </div>
            </div>
        </div>
    );
}