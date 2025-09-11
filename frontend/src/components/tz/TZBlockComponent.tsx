"use client";

import { useState } from "react";
import type { TZBlock, TZBlockType } from "@/types/tz";
import {
    ChevronDown,
    ChevronUp,
    Trash2,
    Plus,
    X,
    Hash,
    Type,
    List,
    CheckCircle,
    GripVertical,
} from "lucide-react";

type Props = {
    block: TZBlock;
    onUpdate: (block: TZBlock) => void;
    onDelete: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
};

const BLOCK_TYPE_CONFIG = {
    H1: { label: 'H1', icon: Hash, color: 'text-red-600 bg-red-50' },
    H2: { label: 'H2', icon: Hash, color: 'text-blue-600 bg-blue-50' },
    H3: { label: 'H3', icon: Hash, color: 'text-green-600 bg-green-50' },
    H4: { label: 'H4', icon: Hash, color: 'text-purple-600 bg-purple-50' },
    paragraph: { label: 'Абзац', icon: Type, color: 'text-gray-600 bg-gray-50' },
    list: { label: 'Список', icon: List, color: 'text-orange-600 bg-orange-50' },
    conclusion: { label: 'Вывод', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
};

export default function TZBlockComponent({
                                             block,
                                             onUpdate,
                                             onDelete,
                                             onMoveUp,
                                             onMoveDown,
                                             canMoveUp,
                                             canMoveDown
                                         }: Props) {
    const config = BLOCK_TYPE_CONFIG[block.type];
    const Icon = config.icon;

    const updateTitle = (title: string) => {
        onUpdate({ ...block, title });
    };

    const updateDescription = (index: number, value: string) => {
        const newDescription = [...block.description];
        newDescription[index] = value;
        onUpdate({ ...block, description: newDescription });
    };

    const addDescriptionPoint = () => {
        onUpdate({
            ...block,
            description: [...block.description, ""]
        });
    };

    const removeDescriptionPoint = (index: number) => {
        if (block.description.length > 1) {
            const newDescription = block.description.filter((_, i) => i !== index);
            onUpdate({ ...block, description: newDescription });
        }
    };

    const toggleCollapsed = () => {
        onUpdate({ ...block, collapsed: !block.collapsed });
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            {/* Заголовок блока */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-3 flex-1">
                    {/* Иконка типа блока */}
                    <div className={`p-2 rounded-lg ${config.color}`}>
                        <Icon className="w-4 h-4" />
                    </div>

                    {/* Тип и название */}
                    <div className="flex items-center gap-2 flex-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${config.color}`}>
                            {config.label}
                        </span>
                        <input
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            placeholder={`Введите название ${config.label.toLowerCase()}...`}
                            value={block.title}
                            onChange={(e) => updateTitle(e.target.value)}
                        />
                    </div>
                </div>

                {/* Кнопки управления */}
                <div className="flex items-center gap-1">
                    {/* Перемещение */}
                    <div className="flex flex-col">
                        <button
                            onClick={onMoveUp}
                            disabled={!canMoveUp}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Переместить вверх"
                        >
                            <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onMoveDown}
                            disabled={!canMoveDown}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Переместить вниз"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Свернуть/развернуть */}
                    <button
                        onClick={toggleCollapsed}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        title={block.collapsed ? "Развернуть" : "Свернуть"}
                    >
                        {block.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>

                    {/* Удалить */}
                    <button
                        onClick={onDelete}
                        className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Удалить блок"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Содержимое блока (показывается только если не свернут) */}
            {!block.collapsed && (
                <div className="p-4 space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-gray-700">Описание</h4>
                            <button
                                onClick={addDescriptionPoint}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                                <Plus className="w-3 h-3" />
                                Добавить пункт
                            </button>
                        </div>

                        <div className="space-y-2">
                            {block.description.map((point, index) => (
                                <div key={index} className="flex items-start gap-2">
                                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs text-gray-500 mt-2">
                                        •
                                    </span>
                                    <textarea
                                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                                        placeholder="Опишите содержимое этого пункта..."
                                        value={point}
                                        onChange={(e) => updateDescription(index, e.target.value)}
                                        rows={2}
                                    />
                                    {block.description.length > 1 && (
                                        <button
                                            onClick={() => removeDescriptionPoint(index)}
                                            className="flex-shrink-0 p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors mt-1"
                                            title="Удалить пункт"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}