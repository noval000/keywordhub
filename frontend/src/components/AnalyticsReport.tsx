// components/AnalyticsReport.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    BarChart3,
    Calendar,
    Target,
    CheckCircle,
    Clock,
    FileText,
    Edit,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';

interface PeriodAnalytics {
    period: string;
    direction: string;
    total_themes: number;
    tz_count: number;
    written_count: number;
    ready_count: number;
    prod_count: number;
    tz_progress: number;
    written_progress: number;
    ready_progress: number;
    prod_progress: number;
}

interface AnalyticsData {
    periods: PeriodAnalytics[];
    directions: PeriodAnalytics[];
    totals: {
        total_themes: number;
        tz_count: number;
        written_count: number;
        ready_count: number;
        prod_count: number;
        tz_progress: number;
        written_progress: number;
        ready_progress: number;
        prod_progress: number;
    };
}

const ProgressBar: React.FC<{
    value: number;
    color?: 'blue' | 'orange' | 'green' | 'purple' | 'primary';
}> = ({ value, color = 'primary' }) => {
    const colorClasses = {
        blue: 'bg-blue-500',
        orange: 'bg-orange-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500',
        primary: 'bg-[var(--color-primary)]'
    };

    return (
        <div className="flex items-center space-x-2 min-w-0">
            <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden min-w-[80px]">
                <div
                    className={`h-full ${colorClasses[color]} transition-all duration-300 rounded-full`}
                    style={{ width: `${Math.min(value, 100)}%` }}
                />
            </div>
            <span className="text-xs text-white font-medium min-w-fit">
                {value}%
            </span>
        </div>
    );
};

type SortField = 'period' | 'direction' | 'total_themes' | 'tz_count' | 'written_count' | 'ready_count' | 'prod_count' | 'prod_progress';
type SortDirection = 'asc' | 'desc';

const AnalyticsReport: React.FC<{ projectId?: string }> = ({ projectId }) => {
    const [activeTab, setActiveTab] = useState<'periods' | 'directions'>('periods');
    const [sortField, setSortField] = useState<SortField>('prod_progress');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const { data: analytics, isLoading, error } = useQuery({
        queryKey: ['analytics', projectId],
        queryFn: async () => {
            const params = projectId ? { project_id: projectId } : {};
            const response = await api.get<AnalyticsData>('/analytics/report', { params });
            console.log(response.data);
            return response.data;
        }
    });

    // Функция сортировки
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Компонент заголовка с сортировкой
    const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
        const isActive = sortField === field;
        const Icon = isActive
            ? (sortDirection === 'asc' ? ArrowUp : ArrowDown)
            : ArrowUpDown;

        return (
            <button
                onClick={() => handleSort(field)}
                className="flex items-center justify-center gap-2 font-semibold text-gray-800 hover:text-[var(--color-primary)] transition-colors w-full"
            >
                {children}
                <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--color-primary)]' : 'text-gray-400'}`} />
            </button>
        );
    };

    // Отсортированные данные
    const sortedData = useMemo(() => {
        if (!analytics) return [];

        const currentData = activeTab === 'periods' ? analytics.periods : analytics.directions;

        return [...currentData].sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // Обработка строковых значений
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = (bVal as string).toLowerCase();
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [analytics, activeTab, sortField, sortDirection]);

    if (isLoading) {
        return (
            <div className="min-h-screen from-gray-50 via-white to-blue-50/30 flex items-center justify-center">
                <div className="text-center">
                    <Clock className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--color-primary)]" />
                    <p className="text-gray-600">Загрузка аналитики...</p>
                </div>
            </div>
        );
    }

    if (error || !analytics) {
        return (
            <div className="min-h-screen from-gray-50 via-white to-blue-50/30 flex items-center justify-center">
                <div className="text-center text-red-600">
                    <p>Ошибка загрузки данных</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen from-gray-50 via-white to-blue-50/30">
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-2xl bg-[var(--color-primary-hover)] text-white">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Аналитика контент-плана</h1>
                            <p className="text-gray-600 text-sm">Статистика по периодам и направлениям • Всего тем: {analytics.totals.total_themes}</p>
                        </div>
                    </div>
                </div>

                {/* Summary Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Всего тем</p>
                                <p className="text-2xl font-bold text-all mt-1">
                                    {analytics.totals.total_themes}
                                </p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-base rounded-xl">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">ТЗ</p>
                                <p className="text-2xl font-bold text-all mt-1">
                                    {analytics.totals.tz_count}
                                </p>
                                <p className="text-xs text-gray-500">{analytics.totals.tz_progress}%</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-blue rounded-xl">
                                <Edit className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Написано</p>
                                <p className="text-2xl font-bold text-all mt-1">
                                    {analytics.totals.written_count}
                                </p>
                                <p className="text-xs text-gray-500">{analytics.totals.written_progress}%</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-green rounded-xl">
                                <Edit className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Готово</p>
                                <p className="text-2xl font-bold text-all mt-1">
                                    {analytics.totals.ready_count}
                                </p>
                                <p className="text-xs text-gray-500">{analytics.totals.ready_progress}%</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-pink rounded-xl">
                                <CheckCircle className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Прод</p>
                                <p className="text-2xl font-bold text-all mt-1">
                                    {analytics.totals.prod_count}
                                </p>
                                <p className="text-xs text-gray-500">{analytics.totals.prod_progress}%</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br bg-purple rounded-xl">
                                <Target className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/20 shadow-xl overflow-hidden">
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('periods')}
                            className={`flex-1 px-6 py-4 font-medium transition-colors ${
                                activeTab === 'periods'
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Calendar className="w-4 h-4" />
                                По периодам
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('directions')}
                            className={`flex-1 px-6 py-4 font-medium transition-colors ${
                                activeTab === 'directions'
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Target className="w-4 h-4" />
                                По направлениям
                            </div>
                        </button>
                    </div>

                    {/* Информация о сортировке */}
                    <div className="px-6 py-3 bg-[var(--color-coffee)]/20 border-b border-gray-200">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">
                                Всего строк: <strong>{sortedData.length}</strong>
                            </span>
                            <div className="flex items-center gap-2 text-[var(--color-coffee-text)]">
                                <span>Сортировка:</span>
                                <span className="font-medium">
                                    {sortField === 'period' && 'Период'}
                                    {sortField === 'direction' && 'Направление'}
                                    {sortField === 'total_themes' && 'Всего тем'}
                                    {sortField === 'tz_count' && 'ТЗ'}
                                    {sortField === 'written_count' && 'Написано'}
                                    {sortField === 'ready_count' && 'Готово'}
                                    {sortField === 'prod_count' && 'Прод'}
                                    {sortField === 'prod_progress' && 'Прогресс'}
                                </span>
                                {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[var(--color-coffee)]/10 border-b border-gray-200">
                            <tr>
                                <th className="text-left p-3 min-w-[120px]">
                                    <SortableHeader field={activeTab === 'periods' ? 'period' : 'direction'}>
                                        {activeTab === 'periods' ? 'Период' : 'Направление'}
                                    </SortableHeader>
                                </th>
                                <th className="text-center p-3 min-w-[80px]">
                                    <SortableHeader field="total_themes">
                                        Тема
                                    </SortableHeader>
                                </th>
                                <th className="text-center p-3 min-w-[80px]">
                                    <SortableHeader field="tz_count">
                                        ТЗ
                                    </SortableHeader>
                                </th>
                                <th className="text-center p-3 min-w-[80px]">
                                    <SortableHeader field="written_count">
                                        Написано
                                    </SortableHeader>
                                </th>
                                <th className="text-center p-3 min-w-[80px]">
                                    <SortableHeader field="ready_count">
                                        Готово
                                    </SortableHeader>
                                </th>
                                <th className="text-center p-3 min-w-[80px]">
                                    <SortableHeader field="prod_count">
                                        Прод
                                    </SortableHeader>
                                </th>
                                <th className="text-center p-3 min-w-[150px]">
                                    <SortableHeader field="prod_progress">
                                        Прогресс
                                    </SortableHeader>
                                </th>
                            </tr>
                            </thead>

                            <tbody>
                            {sortedData.map((row, rowIndex) => (
                                <tr
                                    key={rowIndex}
                                    className={`hover:bg-[var(--color-primary)]/5 transition-colors ${
                                        rowIndex % 2 === 0 ? 'bg-white/50' : 'bg-gray-50/50'
                                    }`}
                                >
                                    <td className="p-3 font-medium text-gray-800">
                                        {activeTab === 'periods' ? row.period : row.direction}
                                    </td>
                                    <td className="p-3 text-center font-medium text-all">
                                        {row.total_themes}
                                    </td>
                                    <td className="p-3 text-center text-all font-medium">
                                        {row.tz_count}
                                    </td>
                                    <td className="p-3 text-center text-all font-medium">
                                        {row.written_count}
                                    </td>
                                    <td className="p-3 text-center text-all font-medium">
                                        {row.ready_count}
                                    </td>
                                    <td className="p-3 text-center text-all font-medium">
                                        {row.prod_count}
                                    </td>
                                    <td className="p-3">
                                        <ProgressBar
                                            value={row.prod_progress}
                                            color="primary"
                                        />
                                    </td>
                                </tr>
                            ))}

                            {/* Totals Row */}
                            <tr className="bg-[var(--color-primary)] text-white font-semibold">
                                <td className="p-3">Итого</td>
                                <td className="p-3 text-center">{analytics.totals.total_themes}</td>
                                <td className="p-3 text-center">{analytics.totals.tz_count}</td>
                                <td className="p-3 text-center">{analytics.totals.written_count}</td>
                                <td className="p-3 text-center">{analytics.totals.ready_count}</td>
                                <td className="p-3 text-center">{analytics.totals.prod_count}</td>
                                <td className="p-3">
                                    <ProgressBar
                                        value={analytics.totals.prod_progress}
                                        color="green"
                                    />
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsReport;