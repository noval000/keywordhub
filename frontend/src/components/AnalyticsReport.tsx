// components/AnalyticsReport.tsx
"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart3, Calendar, Target, CheckCircle, Clock, FileText, Edit } from 'lucide-react';

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
    color?: 'blue' | 'orange' | 'green' | 'purple';
}> = ({ value, color = 'blue' }) => {
    const colorClasses = {
        blue: 'bg-blue-500',
        orange: 'bg-orange-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500'
    };

    return (
        <div className="flex items-center space-x-2 min-w-0">
            <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden min-w-[80px]">
                <div
                    className={`h-full ${colorClasses[color]} transition-all duration-300 rounded-full`}
                    style={{ width: `${Math.min(value, 100)}%` }}
                />
            </div>
            <span className="text-xs text-gray-600 font-medium min-w-fit">
        {value}%
      </span>
        </div>
    );
};

const AnalyticsReport: React.FC<{ projectId?: string }> = ({ projectId }) => {
    const [activeTab, setActiveTab] = useState<'periods' | 'directions'>('periods');

    const { data: analytics, isLoading, error } = useQuery({
        queryKey: ['analytics', projectId],
        queryFn: async () => {
            const params = projectId ? { project_id: projectId } : {};
            const response = await api.get<AnalyticsData>('/analytics/report', { params });
            return response.data;
        }
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 flex items-center justify-center">
                <div className="text-center">
                    <Clock className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
                    <p className="text-gray-600">Загрузка аналитики...</p>
                </div>
            </div>
        );
    }

    if (error || !analytics) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 flex items-center justify-center">
                <div className="text-center text-red-600">
                    <p>Ошибка загрузки данных</p>
                </div>
            </div>
        );
    }

    const currentData = activeTab === 'periods' ? analytics.periods : analytics.directions;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Аналитика контент-плана</h1>
                            <p className="text-gray-600 text-sm">Статистика по периодам и направлениям</p>
                        </div>
                    </div>
                </div>

                {/* Summary Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Всего тем</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {analytics.totals.total_themes}
                                </p>
                            </div>
                            <div className="p-2 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">ТЗ</p>
                                <p className="text-2xl font-bold text-blue-600 mt-1">
                                    {analytics.totals.tz_count}
                                </p>
                                <p className="text-xs text-gray-500">{analytics.totals.tz_progress}%</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                                <Edit className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Написано</p>
                                <p className="text-2xl font-bold text-orange-600 mt-1">
                                    {analytics.totals.written_count}
                                </p>
                                <p className="text-xs text-gray-500">{analytics.totals.written_progress}%</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl">
                                <Edit className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Готово</p>
                                <p className="text-2xl font-bold text-purple-600 mt-1">
                                    {analytics.totals.ready_count}
                                </p>
                                <p className="text-xs text-gray-500">{analytics.totals.ready_progress}%</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
                                <CheckCircle className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Прод</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">
                                    {analytics.totals.prod_count}
                                </p>
                                <p className="text-xs text-gray-500">{analytics.totals.prod_progress}%</p>
                            </div>
                            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
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
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            По периодам
                        </button>
                        <button
                            onClick={() => setActiveTab('directions')}
                            className={`flex-1 px-6 py-4 font-medium transition-colors ${
                                activeTab === 'directions'
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            По направлениям
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-blue-50 border-b border-blue-200">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-800 min-w-[120px]">
                                    {activeTab === 'periods' ? 'Период' : 'Направление'}
                                </th>
                                <th className="text-center p-3 font-semibold text-gray-800 min-w-[80px]">
                                    Тема
                                </th>
                                <th className="text-center p-3 font-semibold text-gray-800 min-w-[80px]">
                                    ТЗ
                                </th>
                                <th className="text-center p-3 font-semibold text-gray-800 min-w-[80px]">
                                    Написано
                                </th>
                                <th className="text-center p-3 font-semibold text-gray-800 min-w-[80px]">
                                    Готово
                                </th>
                                <th className="text-center p-3 font-semibold text-gray-800 min-w-[80px]">
                                    Прод
                                </th>
                                <th className="text-center p-3 font-semibold text-gray-800 min-w-[150px]">
                                    Прогресс
                                </th>
                            </tr>
                            </thead>

                            <tbody>
                            {currentData.map((row, rowIndex) => (
                                <tr
                                    key={rowIndex}
                                    className={`hover:bg-blue-50/50 transition-colors ${
                                        rowIndex % 2 === 0 ? 'bg-white/50' : 'bg-gray-50/50'
                                    }`}
                                >
                                    <td className="p-3 font-medium text-gray-800">
                                        {activeTab === 'periods' ? row.period : row.direction}
                                    </td>
                                    <td className="p-3 text-center font-medium text-gray-800">
                                        {row.total_themes}
                                    </td>
                                    <td className="p-3 text-center text-blue-700 font-medium">
                                        {row.tz_count}
                                    </td>
                                    <td className="p-3 text-center text-orange-700 font-medium">
                                        {row.written_count}
                                    </td>
                                    <td className="p-3 text-center text-purple-700 font-medium">
                                        {row.ready_count}
                                    </td>
                                    <td className="p-3 text-center text-green-700 font-medium">
                                        {row.prod_count}
                                    </td>
                                    <td className="p-3">
                                        <ProgressBar
                                            value={row.prod_progress}
                                            color="green"
                                        />
                                    </td>
                                </tr>
                            ))}

                            {/* Totals Row */}
                            <tr className="bg-blue-600 text-white font-semibold">
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