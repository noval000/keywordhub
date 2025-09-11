"use client";

import "../../app/globals.css";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tzCreate, tzGet, tzUpdate, type CPItem, api } from "@/lib/api";
import type { TZData, TZBlock, TZBlockType } from "@/types/tz";
import TZBlockComponent from "./TZBlockComponent";
import TZGlobalFields from "./TZGlobalFields";
import {
    X,
    Plus,
    ChevronDown,
    ChevronUp,
    Trash2,
    Save,
    FileText,
    Hash,
    List,
    Type,
    CheckCircle,
} from "lucide-react";

type Props = {
    open: boolean;
    onClose: () => void;
    contentPlanItem?: CPItem; // ← Сделать опциональным
    tzId?: string | null; // ← Добавить ID ТЗ для редактирования
    mode?: 'create' | 'edit'; // ← Добавить режим
    onSaved?: () => void;
};

const BLOCK_TYPES: Array<{ type: TZBlockType; label: string; icon: any }> = [
    { type: 'H1', label: 'H1 - Заголовок', icon: Hash },
    { type: 'H2', label: 'H2 - Подзаголовок', icon: Hash },
    { type: 'H3', label: 'H3 - Раздел', icon: Hash },
    { type: 'H4', label: 'H4 - Подраздел', icon: Hash },
    { type: 'paragraph', label: 'Абзац', icon: Type },
    { type: 'list', label: 'Список', icon: List },
    { type: 'conclusion', label: 'Вывод', icon: CheckCircle },
];

export default function TZCreateModal({
      open,
      onClose,
      contentPlanItem,
      tzId,
      mode = 'create', // ← По умолчанию создание
      onSaved
  }: Props) {
    const [loading, setLoading] = useState(false);
    const [tzData, setTzData] = useState<TZData | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const qc = useQueryClient();

    // Инициализация формы
    useEffect(() => {
        if (!open) return;

        const loadTZ = async () => {
            console.log('Loading TZ:', { mode, tzId, contentPlanItem }); // ← Добавить лог
            try {
                if (mode === 'edit' && tzId) {
                    console.log('Editing TZ with ID:', tzId); // ← Добавить лог
                    // Режим редактирования - загружаем по ID ТЗ
                    const response = await api.get(`/tz/${tzId}`);
                    console.log('Loaded TZ data:', response.data); // ← Добавить лог
                    const tzData = {
                        ...response.data,
                        blocks: response.data.blocks?.map((block: any, index: number) => ({
                            id: block.id || `block_${index}`,
                            type: block.type || block.block_type,
                            title: block.title,
                            description: Array.isArray(block.description)
                                ? block.description
                                : block.content
                                    ? [block.content]
                                    : [""],
                            collapsed: block.collapsed || false,
                        })) || []
                    };
                    setTzData(response.data);
                    setIsEditing(true);
                } else if (mode === 'create' && contentPlanItem) {
                    console.log('Creating TZ for item:', contentPlanItem.id);
                    // Режим создания - проверяем есть ли ТЗ для элемента
                    const existing = await tzGet(contentPlanItem.id);
                    if (existing) {
                        setTzData(existing);
                        setIsEditing(true);
                    } else {
                        // Создаем новое ТЗ
                        const newTZ: TZData = {
                            content_plan_id: contentPlanItem.id,
                            title: contentPlanItem.topic || "Новое ТЗ",
                            author: contentPlanItem.author || "",
                            blocks: [],
                            keywords: [],
                            count: null,
                            usage_form: "",
                            lsi_phrases: [],
                            competitors: [],
                        };
                        setTzData(newTZ);
                        setIsEditing(false);
                    }
                }
            } catch (error) {
                console.error('Error loading TZ:', error);
                console.error('Error loading TZ:', error);
                // В случае ошибки создаем пустое ТЗ только для режима создания
                if (mode === 'create' && contentPlanItem) {
                    const newTZ: TZData = {
                        content_plan_id: contentPlanItem.id,
                        title: contentPlanItem.topic || "Новое ТЗ",
                        author: contentPlanItem.author || "",
                        blocks: [],
                        keywords: [],
                        count: null,
                        usage_form: "",
                        lsi_phrases: [],
                        competitors: [],
                    };
                    setTzData(newTZ);
                    setIsEditing(false);
                }
            }
        };

        loadTZ();
    }, [open, contentPlanItem, tzId, mode]);

    // Мутации для сохранения
    const createMutation = useMutation({
        mutationFn: tzCreate,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["tz"] });
            onSaved?.();
            onClose();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }: { id: string } & Partial<TZData>) =>
            tzUpdate(id, { id, ...data }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["tz"] });
            onSaved?.();
            onClose();
        },
    });

    if (!open || !tzData) return null;

    const handleSave = async () => {
        // Валидация
        if (!tzData.title.trim()) {
            alert('Название ТЗ обязательно');
            return;
        }

        if (tzData.blocks.length === 0) {
            alert('Добавьте хотя бы один блок');
            return;
        }

        // Проверяем, что у всех блоков есть названия
        const emptyBlocks = tzData.blocks.filter(block => !block.title.trim());
        if (emptyBlocks.length > 0) {
            alert('У всех блоков должны быть заполнены названия');
            return;
        }

        setLoading(true);
        try {
            if (isEditing && tzData.id) {
                await updateMutation.mutateAsync({ id: tzData.id, ...tzData });
            } else {
                const { id, created_at, updated_at, ...createData } = tzData;
                await createMutation.mutateAsync(createData);
            }
        } catch (error) {
            console.error('Error saving TZ:', error);
            alert('Ошибка сохранения ТЗ');
        } finally {
            setLoading(false);
        }
    };

    const addBlock = (type: TZBlockType) => {
        const newBlock: TZBlock = {
            id: `block_${Date.now()}`,
            type,
            title: "",
            description: [""],
            collapsed: false,
        };
        setTzData(prev => prev ? {
            ...prev,
            blocks: [...prev.blocks, newBlock]
        } : null);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-[1000px] max-w-[95vw] max-h-[90vh] overflow-hidden">
                {/* Заголовок */}
                <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-blue-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {isEditing ? 'Редактировать ТЗ' : 'Создать ТЗ'}
                            </h2>
                            <p className="text-sm text-gray-600">Тема: {tzData.title}</p>
                        </div>
                    </div>
                    <button
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Содержимое */}
                <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
                    {/* Кнопки добавления блоков */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Добавить блок</h3>
                        <div className="flex flex-wrap gap-2">
                            {BLOCK_TYPES.map((blockType) => {
                                const Icon = blockType.icon;
                                return (
                                    <button
                                        key={blockType.type}
                                        onClick={() => addBlock(blockType.type)}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                                    >
                                        <Icon className="w-4 h-4" />
                                        {blockType.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Блоки ТЗ */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Структура ТЗ</h3>
                        {tzData.blocks.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm">Добавьте первый блок для начала работы</p>
                                <p className="text-xs text-gray-400 mt-1">Выберите тип блока выше</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {tzData.blocks.map((block, index) => (
                                    <TZBlockComponent
                                        key={block.id}
                                        block={block}
                                        canMoveUp={index > 0}
                                        canMoveDown={index < tzData.blocks.length - 1}
                                        onUpdate={(updatedBlock) => {
                                            setTzData(prev => prev ? {
                                                ...prev,
                                                blocks: prev.blocks.map(b =>
                                                    b.id === updatedBlock.id ? updatedBlock : b
                                                )
                                            } : null);
                                        }}
                                        onDelete={() => {
                                            setTzData(prev => prev ? {
                                                ...prev,
                                                blocks: prev.blocks.filter(b => b.id !== block.id)
                                            } : null);
                                        }}
                                        onMoveUp={() => {
                                            if (index > 0) {
                                                setTzData(prev => {
                                                    if (!prev) return null;
                                                    const newBlocks = [...prev.blocks];
                                                    [newBlocks[index - 1], newBlocks[index]] =
                                                        [newBlocks[index], newBlocks[index - 1]];
                                                    return { ...prev, blocks: newBlocks };
                                                });
                                            }
                                        }}
                                        onMoveDown={() => {
                                            if (index < tzData.blocks.length - 1) {
                                                setTzData(prev => {
                                                    if (!prev) return null;
                                                    const newBlocks = [...prev.blocks];
                                                    [newBlocks[index], newBlocks[index + 1]] =
                                                        [newBlocks[index + 1], newBlocks[index]];
                                                    return { ...prev, blocks: newBlocks };
                                                });
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Глобальные поля */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Общие параметры</h3>
                        <TZGlobalFields
                            data={tzData}
                            onUpdate={(updates) => {
                                setTzData(prev => prev ? { ...prev, ...updates } : null);
                            }}
                        />
                    </div>
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
                        disabled={loading}
                        onClick={handleSave}
                    >
                        <Save className="w-4 h-4" />
                        {loading ? "Сохранение..." : "Сохранить"}
                    </button>
                </div>
            </div>
        </div>
    );
}