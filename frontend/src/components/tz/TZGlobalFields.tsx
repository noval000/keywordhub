"use client";

import { useState } from "react";
import type { TZData } from "@/types/tz";
import {
    Plus,
    X,
    Tag,
    Hash,
    FileText,
    Lightbulb,
    ExternalLink,
    Globe,
} from "lucide-react";

type Props = {
    data: TZData;
    onUpdate: (data: Partial<TZData>) => void;
};

export default function TZGlobalFields({ data, onUpdate }: Props) {
    const [newKeyword, setNewKeyword] = useState("");
    const [newLsiPhrase, setNewLsiPhrase] = useState("");
    const [newCompetitor, setNewCompetitor] = useState("");

    // Обработчики для ключевых фраз
    const addKeyword = () => {
        if (newKeyword.trim()) {
            // Разбиваем по переносам строк и запятым
            const keywords = newKeyword
                .split(/[\n,]/)
                .map(keyword => keyword.trim())
                .filter(keyword => keyword && !data.keywords.includes(keyword));

            if (keywords.length > 0) {
                onUpdate({
                    keywords: [...data.keywords, ...keywords]
                });
                setNewKeyword("");
            }
        }
    };

    const removeKeyword = (index: number) => {
        onUpdate({
            keywords: data.keywords.filter((_, i) => i !== index)
        });
    };

    const handleKeywordKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            addKeyword();
        }
    };

    // Обработчики для LSI фраз
    const addLsiPhrase = () => {
        if (newLsiPhrase.trim()) {
            // Разбиваем по переносам строк и фильтруем пустые
            const phrases = newLsiPhrase
                .split('\n')
                .map(phrase => phrase.trim())
                .filter(phrase => phrase && !data.lsi_phrases.includes(phrase));

            if (phrases.length > 0) {
                onUpdate({
                    lsi_phrases: [...data.lsi_phrases, ...phrases]
                });
                setNewLsiPhrase("");
            }
        }
    };

    const removeLsiPhrase = (index: number) => {
        onUpdate({
            lsi_phrases: data.lsi_phrases.filter((_, i) => i !== index)
        });
    };

    const handleLsiTextareaKeyPress = (e: React.KeyboardEvent) => {
        // Убираем автодобавление по Enter, только по кнопке
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            addLsiPhrase();
        }
    };

    // Обработчики для конкурентов
    const addCompetitor = () => {
        if (newCompetitor.trim()) {
            // Разбиваем по переносам строк и фильтруем пустые
            const competitors = newCompetitor
                .split('\n')
                .map(competitor => competitor.trim())
                .filter(competitor => competitor && !data.competitors.includes(competitor));

            if (competitors.length > 0) {
                onUpdate({
                    competitors: [...data.competitors, ...competitors]
                });
                setNewCompetitor("");
            }
        }
    };

    const removeCompetitor = (index: number) => {
        onUpdate({
            competitors: data.competitors.filter((_, i) => i !== index)
        });
    };

    const handleCompetitorTextareaKeyPress = (e: React.KeyboardEvent) => {
        // Убираем автодобавление по Enter, только по кнопке
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            addCompetitor();
        }
    };

    // Валидация URL для конкурентов
    const isValidUrl = (string: string) => {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    };

    return (
        <div className="space-y-6">
            {/* Ключевые фразы */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Tag className="w-5 h-5 text-blue-600"/>
                    <h4 className="text-lg font-medium text-gray-900">Ключевые фразы</h4>
                </div>

                <div className="space-y-3">
                    {/* Список существующих ключевых фраз */}
                    {data.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {data.keywords.map((keyword, index) => (
                                <span
                                    key={index}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm"
                                >
                                    {keyword}
                                    <button
                                        onClick={() => removeKeyword(index)}
                                        className="ml-1 p-0.5 text-blue-400 hover:text-blue-600 rounded"
                                    >
                                        <X className="w-3 h-3"/>
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Поле для добавления новых */}
                    <div className="flex gap-2">
                        <textarea
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                            placeholder="Введите ключевые фразы (каждая с новой строки или через запятую)..."
                            rows={3}
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            onKeyPress={handleKeywordKeyPress}
                        />
                        <button
                            onClick={addKeyword}
                            disabled={!newKeyword.trim()}
                            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-start"
                        >
                            <Plus className="w-4 h-4"/>
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">
                        Вставьте список фраз, каждая с новой строки или через запятую. Ctrl+Enter для добавления.
                    </p>
                </div>
            </div>

            {/* Количество символов */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Hash className="w-5 h-5 text-green-600"/>
                    <h4 className="text-lg font-medium text-gray-900">Количество символов</h4>
                </div>

                <input
                    type="number"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                    placeholder="Введите требуемое количество символов..."
                    value={data.count || ""}
                    onChange={(e) => onUpdate({
                        count: e.target.value ? parseInt(e.target.value) : null
                    })}
                />
            </div>

            {/* Форма использования */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-purple-600"/>
                    <h4 className="text-lg font-medium text-gray-900">В какой форме использовать</h4>
                </div>

                <textarea
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none"
                    placeholder="Опишите, в какой форме должны использоваться ключевые фразы..."
                    rows={3}
                    value={data.usage_form}
                    onChange={(e) => onUpdate({
                        usage_form: e.target.value
                    })}
                />
            </div>

            {/* LSI фразы */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-orange-600" />
                    <h4 className="text-lg font-medium text-gray-900">LSI фразы</h4>
                </div>

                <div className="space-y-3">
                    {/* Список существующих LSI фраз */}
                    {data.lsi_phrases.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {data.lsi_phrases.map((phrase, index) => (
                                <span
                                    key={index}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm"
                                >
                                    {phrase}
                                    <button
                                        onClick={() => removeLsiPhrase(index)}
                                        className="ml-1 p-0.5 text-orange-400 hover:text-orange-600 rounded"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Поле для добавления новых */}
                    <div className="flex gap-2">
                        <textarea
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none"
                            placeholder="Введите LSI фразы (каждая с новой строки):&#10;последнее время участились&#10;время участились случаи&#10;связанных с тревожными"
                            rows={4}
                            value={newLsiPhrase}
                            onChange={(e) => setNewLsiPhrase(e.target.value)}
                            onKeyPress={handleLsiTextareaKeyPress}
                        />
                        <button
                            onClick={addLsiPhrase}
                            disabled={!newLsiPhrase.trim()}
                            className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-start"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">
                        Вставьте список фраз, каждая с новой строки. Ctrl+Enter для добавления.
                    </p>
                </div>
            </div>

            {/* Конкуренты */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-5 h-5 text-red-600" />
                    <h4 className="text-lg font-medium text-gray-900">Конкуренты</h4>
                </div>

                <div className="space-y-3">
                    {/* Список существующих конкурентов */}
                    {data.competitors.length > 0 && (
                        <div className="space-y-2">
                            {data.competitors.map((competitor, index) => (
                                <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                    <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <span className="flex-1 text-sm text-gray-700 truncate">{competitor}</span>
                                    {isValidUrl(competitor) && (
                                        <a
                                            href={competitor}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                            title="Открыть в новой вкладке"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                    <button
                                        onClick={() => removeCompetitor(index)}
                                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                        title="Удалить"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Поле для добавления новых */}
                    <div className="flex gap-2">
                        <textarea
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                            placeholder="Введите URL конкурентов (каждый с новой строки):&#10;https://example1.com&#10;https://example2.com&#10;https://example3.com"
                            rows={4}
                            value={newCompetitor}
                            onChange={(e) => setNewCompetitor(e.target.value)}
                            onKeyPress={handleCompetitorTextareaKeyPress}
                        />
                        <button
                            onClick={addCompetitor}
                            disabled={!newCompetitor.trim()}
                            className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-start"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">
                        Вставьте список URL, каждый с новой строки. Ctrl+Enter для добавления.
                    </p>
                </div>
            </div>
        </div>
    );
}