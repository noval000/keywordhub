"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { cpUpdate, CPItem, listClusterRegistry, tzDelete } from "@/lib/api";
import Select from "@/components/ui/Select";
import MetaSeoEditor from "@/components/content-plan/MetaSeoEditor";
import { SECTION_OPTIONS, STATUS_OPTIONS } from "@/lib/cp-constants";
import TZCreateModal from "@/components/tz/TZCreateModal";
import {
    formatPeriodRuFromMonthInput,
    toMonthInputFromPeriod,
    normalizeUrl,
    parseCharsDisplay,
    linkBadgeClass,
} from "@/lib/cp-utils";
import {
    Edit,
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
    AlertTriangle, Info,
    Plus,
    Trash2, Eye
} from "lucide-react";
import DirectionSearchSelect from "@/components/content-plan/DirectionSearchSelect";
import UserSelect from "@/components/ui/UserSelect";
import TZViewModal from "@/components/tz/TZViewModal";

type Props = {
    open: boolean;
    item: CPItem | null;
    perProject?: Record<string, string>;
    projectNames?: Record<string, string>;
    onClose: () => void;
    onSaved: () => void;
};

type FormState = Partial<CPItem>;

export default function ContentPlanEditModal({
                                                 open,
                                                 item,
                                                 perProject,
                                                 projectNames,
                                                 onClose,
                                                 onSaved,
                                             }: Props) {
    const pp = perProject ?? {};
    const pn = projectNames ?? {};

    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [directions, setDirections] = useState<string[]>([]);
    const [loadingDirections, setLoadingDirections] = useState(false);

    const [form, setForm] = useState<FormState>({});
    const [monthUI, setMonthUI] = useState<string>("");
    const [charsDisplay, setCharsDisplay] = useState<string>("");

    // состояние для подтверждения удаления
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingTZ, setDeletingTZ] = useState(false);

    //  открытие модалки просмотр тз
    const [showTZViewModal, setShowTZViewModal] = useState(false);

    const [showTZModal, setShowTZModal] = useState(false);
    const [tzMode, setTZMode] = useState<'create' | 'edit'>('create');
    const [editingTZId, setEditingTZId] = useState<string | null>(null);

    const projectIds = useMemo(() => Object.keys(pp), [pp]);
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const allChecked = useMemo(
        () => projectIds.length > 0 && projectIds.every((id) => selectedProjects.includes(id)),
        [projectIds, selectedProjects]
    );

    const hasTechnicalSpecification = useMemo(() => {
        return !!(item?.has_technical_specification && item?.technical_specification_id);
    }, [item]);

    // Получаем направления при открытии модала или изменении выбранных проектов
    useEffect(() => {
        if (!open) return;

        const projectsToFetch = selectedProjects.length > 0 ? selectedProjects : (item?.project_id ? [item.project_id] : []);

        if (projectsToFetch.length === 0) return;

        const fetchDirections = async () => {
            setLoadingDirections(true);
            try {
                // Получаем кластерные реестры для всех выбранных проектов
                const allRegistries = await Promise.all(
                    projectsToFetch.map(projectId => listClusterRegistry(projectId))
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
    }, [open, selectedProjects, item?.project_id]);

// Создаем опции для Select направлений
    const directionOptions = useMemo(() =>
            directions.map(dir => ({ label: dir, value: dir })),
        [directions]
    );

    //  функция удаления ТЗ
    const handleDeleteTZ = async () => {
        if (!item?.technical_specification_id) return;

        setDeletingTZ(true);
        try {
            await tzDelete(item.technical_specification_id);
            setShowDeleteConfirm(false);
            // Можно показать уведомление об успешном удалении
            alert('ТЗ успешно удалено');
            // Обновить данные или закрыть модалку
            onSaved(); // Это обновит данные в родительском компоненте
        } catch (error) {
            console.error('Error deleting TZ:', error);
            alert('Ошибка при удалении ТЗ');
        } finally {
            setDeletingTZ(false);
        }
    };


    useEffect(() => {
        if (!open || !item) return;
        setError(null);
        setMonthUI(toMonthInputFromPeriod(item.period));
        setCharsDisplay(item.chars ? String(item.chars) : "");
        setForm({
            period: item.period ?? null,
            section: item.section ?? null,
            direction: item.direction ?? null,
            topic: item.topic ?? null,
            tz: item.tz ?? null,
            chars: item.chars ?? null,
            status: item.status ?? null,
            author: item.author ?? null,
            reviewing_doctor: item.reviewing_doctor ?? null,  // ИСПРАВЛЕНО: item вместо form
            doctor_approved: item.doctor_approved ?? null,    // ИСПРАВЛЕНО: item вместо form
            review: item.review ?? null,
            meta_seo: item.meta_seo ?? null,
            comment: item.comment ?? null,
            link: item.link ?? null,
            publish_date: item.publish_date ?? null,
        });
        setSelectedProjects(Object.keys(pp));
    }, [open, item, pp]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const setField = useCallback(
        (k: keyof CPItem, v: any) => setForm((prev) => ({ ...prev, [k]: v })),
        []
    );

    const toggleProject = (pid: string) => {
        setSelectedProjects((prev) =>
            prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]
        );
    };
    const toggleAll = () => setSelectedProjects(allChecked ? [] : projectIds);

    const normalizedPayload = useMemo(() => {
        const f = form;
        const s = (x: any) => ((x ?? "") === "" ? null : x);
        return {
            period: s(f.period),
            section: s(f.section),
            direction: s(f.direction),
            topic: s(f.topic),
            tz: s(f.tz),
            chars: f.chars == null || (f.chars as any) === "" ? null : Number(f.chars),
            status: s(f.status),
            author: s(f.author),
            reviewing_doctor: s(f.reviewing_doctor),
            doctor_approved: f.doctor_approved,
            review: s(f.review),
            meta_seo: s(f.meta_seo),
            comment: s(f.comment),
            link: s(f.link),
            publish_date: s(f.publish_date),
        } as Partial<CPItem>;
    }, [form]);

    const onSubmit = async () => {
        if (!item) return;
        setPending(true);
        setError(null);
        try {
            const targetIds = projectIds.length
                ? selectedProjects.map((pid) => pp[pid]).filter(Boolean)
                : [item.id];

            await Promise.all(targetIds.map((id) => cpUpdate(id!, normalizedPayload)));
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e?.message || "Не удалось сохранить изменения");
        } finally {
            setPending(false);
        }
    };

    if (!open || !item) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-rose rounded-3xl shadow-2xl w-[800px] max-w-[95vw] max-h-[90vh] overflow-hidden border border-white/20">
                {/* Заголовок */}
                <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-100 flex items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-[var(--color-primary-hover)] text-white">
                            <Edit className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Информация</h2>
                    </div>
                    <button
                        className="ml-auto p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Содержимое с прокруткой */}
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
                            <FileText className="w-5 h-5 text-[var(--color-primary)]" />
                            Основная информация
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Тема */}
                            <div className="col-span-2 relative">
                                <Hash className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
                                    placeholder="Тема (кластер)"
                                    value={form.topic ?? ""}
                                    onChange={(e) => setField("topic", e.target.value || null)}
                                />
                            </div>

                            {/* Период */}
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="month"
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
                                    value={monthUI}
                                    onChange={(e) => {
                                        setMonthUI(e.target.value);
                                        setField("period", formatPeriodRuFromMonthInput(e.target.value));
                                    }}
                                />
                            </div>

                            {/* Раздел */}
                            <div className="relative">
                                <Tag className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                                <Select
                                    className="w-full pl-12"
                                    value={form.section ?? ""}
                                    onChange={(v) => setField("section", v || null)}
                                    options={SECTION_OPTIONS.map((s) => ({ label: s, value: s }))}
                                    placeholder="Раздел"
                                />
                            </div>

                            {/* Направление с кастомным поиском */}
                            <div className="relative">
                                <div className="">
                                    <Target className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />

                                    <DirectionSearchSelect
                                        value={form.direction ?? ""}
                                        onChange={(v) => setField("direction", v || null)}
                                        options={directions}
                                        placeholder={loadingDirections ? "Загрузка направлений..." : "Направление"}
                                        disabled={loadingDirections}
                                        className="w-full pl-12"
                                    />
                                </div>

                                {/* Информационное сообщение вне relative positioning */}
                                {selectedProjects.length > 1 && (
                                    <div style={{position: "absolute", top: '-14px', fontSize: '10px'}} className="text-gray-500 flex items-center gap-1">
                                        <Info className="w-3 h-3" />
                                        Все направления из реестра кластеров
                                        {directions.length === 0 && " (общих направлений не найдено)"}
                                    </div>
                                )}
                            </div>

                            {/* Статус */}
                            <div className="relative">
                                <Settings className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                                <Select
                                    className="w-full pl-12"
                                    value={form.status ?? ""}
                                    onChange={(v) => setField("status", v || null)}
                                    options={STATUS_OPTIONS.map((s) => ({ label: s, value: s }))}
                                    placeholder="Статус"
                                />
                            </div>

                            {/* Автор */}
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                                <UserSelect
                                    value={form.author ?? ""}
                                    onChange={(v) => setField("author", v || null)}
                                    placeholder="Автор"
                                    className="w-full pl-12"
                                />
                            </div>

                            {/* Символы */}
                            <div className="relative">
                                <Hash className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
                                    placeholder="Символы (например: 1000 (1250))"
                                    value={charsDisplay}
                                    onChange={(e) => {
                                        setCharsDisplay(e.target.value);
                                        const { value } = parseCharsDisplay(e.target.value);
                                        setField("chars", value);
                                    }}
                                />
                            </div>

                            {/* Проверяющий врач */}
                            <div className="relative">
                                <Stethoscope className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"/>
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                    placeholder="Имя проверяющего врача"
                                    value={form.reviewing_doctor ?? ""}
                                    onChange={(e) => setField("reviewing_doctor", e.target.value || null)}
                                />
                            </div>
                            {/* Проверено врачом - ВНУТРИ grid, перед закрывающим </div> на строке 234 */}
                            <label className="flex items-center gap-3 bg-[var(--color-coffee)] rounded-xl p-3 cursor-pointer">

                                <input
                                    type="checkbox"
                                    checked={!!form.doctor_approved}
                                    onChange={(e) => setField("doctor_approved", e.target.checked)}
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
                                <MessageSquare className="absolute left-4 top-4 text-gray-400 w-5 h-5" />
                                <textarea
                                    className="w-full pl-12 pr-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200 resize-none"
                                    placeholder="Комментарий"
                                    rows={3}
                                    value={form.comment ?? ""}
                                    onChange={(e) => setField("comment", e.target.value || null)}
                                />
                            </div>

                            {/* Дата публикации */}
                            <div className="col-span-2 flex items-center gap-3 justify-end bg-gray-50 rounded-xl p-3">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <span className="text-sm font-medium text-gray-700">Дата размещения</span>
                                <input
                                    type="date"
                                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
                                    value={form.publish_date ?? ""}
                                    onChange={(e) => setField("publish_date", e.target.value || null)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Ссылки */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                            <Link2 className="w-5 h-5 text-green-600" />
                            Ссылки
                        </h3>

                        <div className="space-y-4">
                            {/* ТЗ */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    Ссылка на ТЗ
                                    {hasTechnicalSpecification && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                <CheckSquare className="w-3 h-3 mr-1" />
                ТЗ создано
            </span>
                                    )}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 px-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                                        placeholder="Google Docs/Sheets"
                                        value={form.tz ?? ""}
                                        onChange={(e) => setField("tz", e.target.value || null)}
                                        onBlur={(e) => setField("tz", normalizeUrl(e.target.value))}
                                    />
                                    {form.tz && (
                                        <a
                                            href={normalizeUrl(form.tz)!}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4"/>
                                            Открыть
                                        </a>
                                    )}

                                    {/* Кнопки управления ТЗ */}
                                    {hasTechnicalSpecification ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setShowTZViewModal(true)}
                                                className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                                                title="Просмотреть техническое задание"
                                            >
                                                <Eye className="w-4 h-4"/>
                                                Открыть ТЗ
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingTZId(item?.technical_specification_id || null);
                                                    setTZMode('edit');
                                                    setShowTZModal(true);
                                                }}
                                                className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                                                title="Редактировать техническое задание"
                                            >
                                                <FileText className="w-4 h-4"/>
                                                Редактировать
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                                                title="Удалить техническое задание"
                                                disabled={deletingTZ}
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                                {deletingTZ ? 'Удаление...' : 'Удалить'}
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingTZId(null);
                                                setTZMode('create');
                                                setShowTZModal(true);
                                            }}
                                            className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
                                            title="Создать техническое задание"
                                        >
                                            <Plus className="w-4 h-4"/>
                                            Создать ТЗ
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Текст на проверке */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Stethoscope className="w-4 h-4 text-green-600"/>
                                    Текст на проверке у врача
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 px-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200"
                                        placeholder="Ссылка на текст"
                                        value={form.review ?? ""}
                                        onChange={(e) => setField("review", e.target.value || null)}
                                        onBlur={(e) => setField("review", normalizeUrl(e.target.value))}
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
                                        className="flex-1 px-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200"
                                        placeholder="Ссылка на страницу"
                                        value={form.link ?? ""}
                                        onChange={(e) => setField("link", e.target.value || null)}
                                        onBlur={(e) => setField("link", normalizeUrl(e.target.value))}
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
                            <Settings className="w-5 h-5 text-indigo-600" />
                            META SEO
                            <span className="text-sm font-normal text-gray-500">(H1 / Title / Description)</span>
                        </h3>

                        <MetaSeoEditor
                            className="w-full"
                            value={form.meta_seo ?? null}
                            onChange={(v) => setField("meta_seo", v)}
                        />
                    </div>

                    {/* Применить к проектам */}
                    {projectIds.length > 0 && (
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                <Target className="w-5 h-5 text-pink-600" />
                                Применить изменения к проектам
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
                                                ? 'bg-orange-600 border-orange-600'
                                                : 'border-gray-300 hover:border-gray-400'
                                        }`}>
                                            {allChecked && <CheckSquare className="w-5 h-5 text-white" />}
                                        </div>
                                    </div>
                                    <span className="font-medium text-gray-900">Выбрать все проекты</span>
                                </label>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {projectIds.map((pid) => (
                                        <label
                                            key={pid}
                                            className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProjects.includes(pid)}
                                                    onChange={() => toggleProject(pid)}
                                                    className="sr-only"
                                                />
                                                <div className={`w-4 h-4 rounded border-2 transition-colors ${
                                                    selectedProjects.includes(pid)
                                                        ? 'bg-orange-600 border-orange-600'
                                                        : 'border-gray-300'
                                                }`}>
                                                    {selectedProjects.includes(pid) && <CheckSquare className="w-4 h-4 text-white" />}
                                                </div>
                                            </div>
                                            <span className="text-sm text-gray-900 truncate">{pn[pid] || pid}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Футер */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button
                        className="px-6 py-2.5 bg-[var(--color-coffee)] text-[var(--color-coffee-text)] hover:bg-[#b8a99f] hover:text-[var(--color-whte)] transition-colors duration-300 ease-in-out rounded-2xl px-4 py-2"
                        onClick={onClose}
                        disabled={pending}
                    >
                        Отмена
                    </button>
                    <button
                        className="flex items-center gap-2 text-[var(--color-primary)] bg-transparent border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:text-[var(--color-whte)] transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={pending}
                        onClick={onSubmit}
                    >
                        <Save className="w-4 h-4" />
                        {pending ? "Сохранение..." : "Сохранить"}
                    </button>
                </div>
            </div>
            {showTZModal && (
                <TZCreateModal
                    open={showTZModal}
                    mode={tzMode} // ← Добавить режим
                    contentPlanItem={tzMode === 'create' ? item : undefined} // ← Передавать только при создании
                    tzId={tzMode === 'edit' ? editingTZId : undefined} // ← Передавать ID при редактировании
                    onClose={() => {
                        setShowTZModal(false);
                        setEditingTZId(null);
                        // Можно добавить обновление данных если нужно
                    }}
                    onSaved={() => {
                        setShowTZModal(false);
                        setEditingTZId(null);
                        // Здесь можно добавить логику обновления ссылки на ТЗ
                        // или обновить состояние родительского компонента
                    }}
                />
            )}

            {/* Модалка подтверждения удаления ТЗ */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-red-100">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Удалить техническое задание?
                            </h3>
                        </div>

                        <p className="text-gray-600 mb-6">
                            Это действие нельзя отменить. Техническое задание будет удалено навсегда.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deletingTZ}
                                className="flex-1 px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleDeleteTZ}
                                disabled={deletingTZ}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {deletingTZ ? 'Удаление...' : 'Удалить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/*Модалка просмотр ТЗ*/}
            {showTZViewModal && item?.technical_specification_id && (
                <TZViewModal
                    open={showTZViewModal}
                    tzId={item.technical_specification_id}
                    onClose={() => setShowTZViewModal(false)}
                    onEdit={() => {
                        setShowTZViewModal(false);
                        setEditingTZId(item?.technical_specification_id || null);
                        setTZMode('edit');
                        setShowTZModal(true);
                    }}
                />
            )}
        </div>
    );
}