"use client";

import { useEffect, useMemo, useState } from "react";
import { cpCreate, fetchProjects, listClusterRegistry, type CPItem, type ProjectDto } from "@/lib/api";
import Select from "@/components/ui/Select";
import MetaSeoEditor from "@/components/content-plan/MetaSeoEditor";
import { SECTION_OPTIONS, STATUS_OPTIONS } from "@/lib/cp-constants";
import {
    formatPeriodRuFromMonthInput,
    normalizeUrl,
    parseCharsDisplay,
    linkBadgeClass,
} from "@/lib/cp-utils";
import {
    Plus,
    X,
    Calendar,
    User,
    Hash,
    FileText,
    Link2,
    Globe,
    Stethoscope,
    MessageSquare,
    Settings,
    CheckSquare,
    Square,
    ExternalLink,
    Save,
    Target,
    Tag,
    Info
} from "lucide-react";
import DirectionSearchSelect from "@/components/content-plan/DirectionSearchSelect";
import UserSelect from "@/components/ui/UserSelect";

type Props = {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    projects?: ProjectDto[];
};

export default function ContentPlanAddModal({ open, onClose, onSaved, projects: extProjects = [] }: Props) {
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState<Array<{ id: string; name: string }>>(
        extProjects.map((p) => ({ id: p.id, name: p.name }))
    );
    const [checked, setChecked] = useState<Record<string, boolean>>({});

    const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
    const allChecked = useMemo(
        () => projectIds.length > 0 && projectIds.every((id) => checked[id]),
        [projectIds, checked]
    );

    const [directions, setDirections] = useState<string[]>([]);
    const [loadingDirections, setLoadingDirections] = useState(false);

    // Получаем выбранные проекты
    const selectedProjects = useMemo(() =>
            projectIds.filter(id => checked[id]),
        [projectIds, checked]
    );

    const [monthUI, setMonthUI] = useState<string>("");
    const [charsDisplay, setCharsDisplay] = useState<string>("");
    const [form, setForm] = useState<Partial<CPItem>>({});


// Получаем направления при изменении выбранных проектов
    useEffect(() => {
        if (!open || selectedProjects.length === 0) {
            setDirections([]);
            return;
        }

        const fetchDirections = async () => {
            setLoadingDirections(true);
            try {
                // Получаем кластерные реестры для всех выбранных проектов
                const allRegistries = await Promise.all(
                    selectedProjects.map(projectId => listClusterRegistry(projectId))
                );

                // Получаем пересечение направлений (те, что есть во ВСЕХ проектах)
                const getIntersectionDirections = (registries: Array<Array<any>>) => {
                    if (registries.length === 0) return [];

                    // Если только один проект, возвращаем все его направления
                    if (registries.length === 1) {
                        return Array.from(
                            new Set(
                                registries[0]
                                    .map(cluster => cluster.direction)
                                    .filter(direction => direction && direction.trim() !== '')
                            )
                        ).sort();
                    }

                    // Для нескольких проектов ищем пересечение
                    const firstProjectDirections = new Set(
                        registries[0]
                            .map(cluster => cluster.direction)
                            .filter(direction => direction && direction.trim() !== '')
                    );

                    // Проверяем каждый последующий проект
                    for (let i = 1; i < registries.length; i++) {
                        const currentProjectDirections = new Set(
                            registries[i]
                                .map(cluster => cluster.direction)
                                .filter(direction => direction && direction.trim() !== '')
                        );

                        // Удаляем направления, которых нет в текущем проекте
                        for (const direction of firstProjectDirections) {
                            if (!currentProjectDirections.has(direction)) {
                                firstProjectDirections.delete(direction);
                            }
                        }
                    }

                    return Array.from(firstProjectDirections).sort();
                };

                const intersectionDirections = getIntersectionDirections(allRegistries);
                setDirections(intersectionDirections);

            } catch (err) {
                console.error('Failed to fetch cluster registry:', err);
                setDirections([]);
            } finally {
                setLoadingDirections(false);
            }
        };

        fetchDirections();
    }, [open, selectedProjects]);

    // Создаем опции для Select направлений
    const directionOptions = useMemo(() =>
            directions.map(dir => ({ label: dir, value: dir })),
        [directions]
    );


    useEffect(() => {
        if (!open) return;
        (async () => {
            if (extProjects.length) {
                setProjects(extProjects.map((p) => ({ id: p.id, name: p.name })));
                setChecked(Object.fromEntries(extProjects.map((p) => [p.id, true])));
            } else {
                const listActive = await fetchProjects({ archived: false } as any);
                setProjects(listActive.map((p) => ({ id: p.id, name: p.name })));
                setChecked(Object.fromEntries(listActive.map((p) => [p.id, true])));
            }
        })();
    }, [open, extProjects]);

    if (!open) return null;

    const set = (k: keyof CPItem, v: any) => setForm((prev) => ({ ...prev, [k]: v }));
    const toggleAll = () =>
        setChecked(Object.fromEntries(projectIds.map((id) => [id, !allChecked])));
    const toggleOne = (id: string) =>
        setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

    const onSave = async () => {
        const target = projectIds.filter((id) => checked[id]);
        if (!target.length) {
            onClose();
            return;
        }
        setLoading(true);
        try {
            const payload: Partial<CPItem> = {
                period: form.period ?? null,
                section: form.section ?? null,
                direction: form.direction ?? null,
                topic: form.topic ?? null,
                tz: form.tz ? normalizeUrl(form.tz) : null,
                chars: form.chars ?? null,
                status: form.status ?? null,
                author: form.author ?? null,
                reviewing_doctor: form.reviewing_doctor ?? null,
                doctor_approved: form.doctor_approved ?? null,
                review: form.review ? normalizeUrl(form.review) : null,
                meta_seo: form.meta_seo ?? null,
                comment: form.comment ?? null,
                link: form.link ? normalizeUrl(form.link) : null,
                publish_date: form.publish_date ?? null,
            };

            console.log("Payload to send:", payload); // ДОБАВЬТЕ ЭТО
            await cpCreate({ project_ids: target, item: payload });
            onSaved();
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl w-[800px] max-w-[95vw] max-h-[90vh] overflow-hidden border border-white/20">
                {/* Заголовок */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100 flex items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-[var(--color-primary-hover)] text-white">
                            <Plus className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Добавить тему</h2>
                    </div>
                    <button
                        className="ml-auto p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Содержимое с прокруткой */}
                <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
                    {/* Основные поля */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-[var(--color-primary-hover)]" />
                            Основная информация
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Тема */}
                            <div className="col-span-2 relative">
                                <Hash
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"/>
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    placeholder="Тема (кластер)"
                                    value={form.topic ?? ""}
                                    onChange={(e) => set("topic", e.target.value || null)}
                                />
                            </div>

                            {/* Период */}
                            <div className="relative">
                                <Calendar
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"/>
                                <input
                                    type="month"
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    value={monthUI}
                                    onChange={(e) => {
                                        setMonthUI(e.target.value);
                                        set("period", formatPeriodRuFromMonthInput(e.target.value));
                                    }}
                                />
                            </div>

                            {/* Раздел */}
                            <div className="relative">
                                <Tag
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10"/>
                                <Select
                                    className="w-full pl-12"
                                    value={form.section ?? ""}
                                    onChange={(v) => set("section", v || null)}
                                    options={SECTION_OPTIONS.map((s) => ({label: s, value: s}))}
                                    placeholder="Раздел"
                                />
                            </div>

                            {/* Направление с кастомным поиском */}
                            <div className="relative">
                                <div className="">
                                    <Target
                                        className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10"/>

                                    <DirectionSearchSelect
                                        value={form.direction ?? ""}
                                        onChange={(v) => set("direction", v || null)}
                                        options={directions}
                                        placeholder={loadingDirections ? "Загрузка направлений..." : "Направление"}
                                        disabled={loadingDirections}
                                        className="w-full pl-12"
                                    />
                                </div>

                                {/* Информационное сообщение вне relative positioning */}
                                {selectedProjects.length > 1 && (
                                    <div style={{position: "absolute", top: '-14px', fontSize: '10px'}}
                                         className="text-gray-500 flex items-center gap-1">
                                        <Info className="w-3 h-3"/>
                                        Все направления из реестра кластеров
                                        {directions.length === 0 && " (общих направлений не найдено)"}
                                    </div>
                                )}
                            </div>

                            {/* Статус */}
                            <div className="relative">
                                <Settings
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10"/>
                                <Select
                                    className="w-full pl-12"
                                    value={form.status ?? ""}
                                    onChange={(v) => set("status", v || null)}
                                    options={STATUS_OPTIONS.map((s) => ({label: s, value: s}))}
                                    placeholder="Статус"
                                />
                            </div>

                            {/* Автор */}
                            <div className="relative">
                                <User
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10"/>
                                <UserSelect
                                    value={form.author ?? ""}
                                    onChange={(v) => set("author", v || null)}
                                    placeholder="Автор"
                                    className="w-full pl-12"
                                />
                            </div>

                            {/* Символы */}
                            <div className="relative">
                                <Hash
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"/>
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                    placeholder="Символы (например: 1000 (1250))"
                                    value={charsDisplay}
                                    onChange={(e) => {
                                        setCharsDisplay(e.target.value);
                                        const {value} = parseCharsDisplay(e.target.value);
                                        set("chars", value);
                                    }}
                                />
                            </div>

                            {/* Проверяющий врач */}
                                <div className="relative">
                                    <Stethoscope
                                        className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"/>
                                    <input
                                        className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                                        placeholder="Имя проверяющего врача"
                                        value={form.reviewing_doctor ?? ""}
                                        onChange={(e) => set("reviewing_doctor", e.target.value || null)}
                                    />
                                </div>
                            {/* Проверено врачом */}
                                <label className="flex items-center gap-3 bg-[var(--color-coffee)] rounded-xl p-3 cursor-pointer">

                                        <input
                                            type="checkbox"
                                            checked={!!form.doctor_approved}
                                            onChange={(e) => set("doctor_approved", e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-5 h-5 rounded border-2 transition-colors ${
                                            form.doctor_approved
                                                ? 'bg-[var(--color-primary-hover)]'
                                                : 'border-gray-300 hover:border-gray-400'
                                        }`}>
                                            {form.doctor_approved && <CheckSquare className="w-5 h-5 text-white"/>}

                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Stethoscope className="w-5 h-5 text-[var(--color-coffee-text)]"/>
                                        <span className="text-sm font-medium text-[var(--color-coffee-text)]">Проверено врачом</span>
                                    </div>
                                </label>



                            {/* Комментарий */}
                            <div className="col-span-2 relative">
                                <MessageSquare className="absolute left-4 top-4 text-gray-400 w-5 h-5"/>
                                <textarea
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200 resize-none"
                                    placeholder="Комментарий"
                                    rows={3}
                                    value={form.comment ?? ""}
                                    onChange={(e) => set("comment", e.target.value || null)}
                                />
                            </div>

                            {/* Дата публикации */}
                            <div className="col-span-2 flex items-center gap-3 justify-end bg-gray-50 rounded-xl p-3">
                                <Calendar className="w-5 h-5 text-gray-400"/>
                                <span className="text-sm font-medium text-gray-700">Дата размещения</span>
                                <input
                                    type="date"
                                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                    value={form.publish_date ?? ""}
                                    onChange={(e) => set("publish_date", e.target.value || null)}
                                />
                            </div>
                        </div>

                    </div>

                    {/* Ссылки */}
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                        <Link2 className="w-5 h-5 text-[var(--color-primary)]"/>
                        Ссылки
                    </h3>

                    <div className="space-y-4">
                        {/* ТЗ */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-600"/>
                                Ссылка на ТЗ
                            </label>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 px-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                        placeholder="Google Docs/Sheets"
                                        value={form.tz ?? ""}
                                        onChange={(e) => set("tz", e.target.value || null)}
                                    />
                                    {form.tz && (
                                        <a
                                            href={normalizeUrl(form.tz)!}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Открыть
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Текст на проверке */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Stethoscope className="w-4 h-4 text-green-600" />
                                    Текст на проверке у врача
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 px-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                        placeholder="Ссылка на текст"
                                        value={form.review ?? ""}
                                        onChange={(e) => set("review", e.target.value || null)}
                                    />
                                    {form.review && (
                                        <a
                                            href={normalizeUrl(form.review)!}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Открыть
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Опубликованная страница */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-purple-600" />
                                    Опубликованная страница
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 px-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                        placeholder="Ссылка на страницу"
                                        value={form.link ?? ""}
                                        onChange={(e) => set("link", e.target.value || null)}
                                    />
                                    {form.link && (
                                        <a
                                            href={normalizeUrl(form.link)!}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Открыть
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* META SEO */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                            <Settings className="w-5 h-5 text-orange-600" />
                            META SEO
                            <span className="text-sm font-normal text-gray-500">(H1 / Title / Description)</span>
                        </h3>

                        <MetaSeoEditor
                            className="w-full"
                            value={form.meta_seo ?? null}
                            onChange={(v) => set("meta_seo", v)}
                        />
                    </div>

                    {/* Выбор проектов */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                            <Target className="w-5 h-5 text-[var(--color-primary-hover)]" />
                            Привязать к проектам
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
                                            ? 'bg-blue-600 border-blue-600'
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
                                                checked={!!checked[p.id]}
                                                onChange={() => toggleOne(p.id)}
                                                className="sr-only"
                                            />
                                            <div className={`w-4 h-4 rounded border-2 transition-colors ${
                                                checked[p.id]
                                                    ? 'bg-blue-600 border-blue-600'
                                                    : 'border-gray-300'
                                            }`}>
                                                {checked[p.id] && <CheckSquare className="w-4 h-4 text-white" />}
                                            </div>
                                        </div>
                                        <span className="text-sm text-gray-900 truncate">{p.name}</span>
                                    </label>
                                ))}
                            </div>
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
                        {loading ? "Сохранение..." : "Сохранить"}
                    </button>
                </div>
            </div>
        </div>
    );
}