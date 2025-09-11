// components/tz/TZViewModal.tsx
"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { TZData } from "@/types/tz";
import {
    X,
    FileText,
    Hash,
    List,
    Type,
    CheckCircle,
    User,
    Calendar,
    Target,
    Key,
    Users,
    Edit3,
    Eye,
    Clock,
} from "lucide-react";

type Props = {
    open: boolean;
    tzId: string;
    onClose: () => void;
    onEdit?: () => void;
};

const BLOCK_TYPE_ICONS = {
    H1: Hash,
    H2: Hash,
    H3: Hash,
    H4: Hash,
    paragraph: Type,
    list: List,
    conclusion: CheckCircle,
};

const BLOCK_TYPE_LABELS = {
    H1: 'Заголовок H1',
    H2: 'Подзаголовок H2',
    H3: 'Раздел H3',
    H4: 'Подраздел H4',
    paragraph: 'Абзац',
    list: 'Список',
    conclusion: 'Вывод',
};

export default function TZViewModal({ open, tzId, onClose, onEdit }: Props) {
    const [loading, setLoading] = useState(true);
    const [tzData, setTzData] = useState<TZData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !tzId) return;

        const loadTZ = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await api.get(`/tz/${tzId}`);
                setTzData(response.data);
            } catch (error) {
                console.error('Error loading TZ:', error);
                setError('Не удалось загрузить техническое задание');
            } finally {
                setLoading(false);
            }
        };

        loadTZ();
    }, [open, tzId]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-[900px] max-w-[95vw] max-h-[90vh] overflow-hidden">
                {/* Заголовок */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                            <Eye className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Техническое задание
                            </h2>
                            {tzData && (
                                <p className="text-sm text-gray-600">{tzData.title}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                title="Редактировать ТЗ"
                            >
                                <Edit3 className="w-4 h-4" />
                                Редактировать
                            </button>
                        )}
                        <button
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                            onClick={onClose}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Содержимое */}
                <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-3 text-gray-600">Загрузка...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <div className="p-3 rounded-xl bg-red-100 inline-block mb-3">
                                <FileText className="w-8 h-8 text-red-600" />
                            </div>
                            <p className="text-red-600 font-medium">{error}</p>
                        </div>
                    ) : !tzData ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">ТЗ не найдено</p>
                        </div>
                    ) : (
                        <>
                            {/* Основная информация */}
                            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <FileText className="w-4 h-4" />
                                            <span className="font-medium">Название</span>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900">{tzData.title}</p>
                                    </div>

                                    {tzData.author && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <User className="w-4 h-4" />
                                                <span className="font-medium">Автор</span>
                                            </div>
                                            <p className="text-gray-900">{tzData.author}</p>
                                        </div>
                                    )}

                                    {tzData.count && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Target className="w-4 h-4" />
                                                <span className="font-medium">Объем</span>
                                            </div>
                                            <p className="text-gray-900">{tzData.count} символов</p>
                                        </div>
                                    )}

                                    {tzData.created_at && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Clock className="w-4 h-4" />
                                                <span className="font-medium">Создано</span>
                                            </div>
                                            <p className="text-gray-900">
                                                {new Date(tzData.created_at).toLocaleDateString('ru-RU')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Ключевые фразы и LSI */}
                            {(tzData.keywords?.length || tzData.lsi_phrases?.length || tzData.competitors?.length) && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {tzData.keywords?.length > 0 && (
                                        <div className="bg-green-50 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Key className="w-4 h-4 text-green-600" />
                                                <h3 className="font-semibold text-green-900">Ключевые фразы</h3>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {tzData.keywords.map((keyword, index) => (
                                                    <span
                                                        key={index}
                                                        className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                                                    >
                                                        {keyword}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {tzData.lsi_phrases?.length > 0 && (
                                        <div className="bg-blue-50 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Hash className="w-4 h-4 text-blue-600" />
                                                <h3 className="font-semibold text-blue-900">LSI фразы</h3>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {tzData.lsi_phrases.map((phrase, index) => (
                                                    <span
                                                        key={index}
                                                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                                                    >
                                                        {phrase}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {tzData.competitors?.length > 0 && (
                                        <div className="bg-purple-50 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Users className="w-4 h-4 text-purple-600" />
                                                <h3 className="font-semibold text-purple-900">Конкуренты</h3>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {tzData.competitors.map((competitor, index) => (
                                                    <span
                                                        key={index}
                                                        className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                                                    >
                                                        {competitor}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Структура ТЗ */}
                            {tzData.blocks?.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-indigo-600" />
                                        Структура контента
                                    </h3>

                                    <div className="space-y-3">
                                        {tzData.blocks.map((block, index) => {
                                            const Icon = BLOCK_TYPE_ICONS[block.type as keyof typeof BLOCK_TYPE_ICONS] || Type;
                                            const label = BLOCK_TYPE_LABELS[block.type as keyof typeof BLOCK_TYPE_LABELS] || block.type;

                                            return (
                                                <div key={block.id || index} className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                                                    <div className="flex items-start gap-3">
                                                        <div className="p-2 rounded-lg bg-indigo-50">
                                                            <Icon className="w-4 h-4 text-indigo-600" />
                                                        </div>
                                                        <div className="flex-1 space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-medium">
                                                                    {label}
                                                                </span>
                                                                <span className="text-sm text-gray-500">#{index + 1}</span>
                                                            </div>

                                                            {block.title && (
                                                                <h4 className="font-semibold text-gray-900">{block.title}</h4>
                                                            )}

                                                            {block.description?.length > 0 && (
                                                                <div className="space-y-1">
                                                                    {block.description.map((desc, descIndex) => (
                                                                        desc.trim() && (
                                                                            <p key={descIndex} className="text-gray-700 text-sm leading-relaxed">
                                                                                {desc}
                                                                            </p>
                                                                        )
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Дополнительные требования */}
                            {tzData.usage_form && (
                                <div className="bg-yellow-50 rounded-2xl p-6">
                                    <h3 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Форма использования
                                    </h3>
                                    <p className="text-yellow-800 leading-relaxed">{tzData.usage_form}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}