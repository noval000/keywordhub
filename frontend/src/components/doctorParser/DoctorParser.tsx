"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Upload, Play, Download, Trash2, Clock, CheckCircle, AlertCircle, FileText, HelpCircle } from 'lucide-react';

interface Task {
    id: number;
    task_id: string;  // UUID как строка
    task_name: string;
    total_profiles: number;  // Исправлено с urls_count
    processed_profiles: number;  // Исправлено с completed_count
    status: string;
    progress_percentage: number;
    created_at: string;
    completed_at?: string;
    error_message?: string;
}

const DoctorParser: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileTaskName, setFileTaskName] = useState('');  // Отдельное состояние для файлов
    const [manualTaskName, setManualTaskName] = useState('');  // Отдельное состояние для ручного ввода
    const [urls, setUrls] = useState('');
    const [proxies, setProxies] = useState('');
    const [fileProxies, setFileProxies] = useState('');
    const [showProxyHelp, setShowProxyHelp] = useState(false);
    const [showFileHelp, setShowFileHelp] = useState(false);
    const queryClient = useQueryClient();

    const { data: tasks, refetch } = useQuery({
        queryKey: ['parsing-tasks'],
        queryFn: async () => {
            const response = await api.get<{tasks: Task[]}>('/parser/tasks');
            return response.data.tasks;
        },
        refetchInterval: 2000
    });

    const uploadMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const response = await api.post('/parser/upload-urls', formData);
            return response.data;
        },
        onSuccess: () => {
            setSelectedFile(null);
            setFileTaskName('');  // Очищаем правильное поле
            setFileProxies('');
            queryClient.invalidateQueries({queryKey: ['parsing-tasks']});
        }
    });

    const startParsingMutation = useMutation({
        mutationFn: async (data: {urls: string[], task_name: string, proxy_list: string[]}) => {
            const response = await api.post('/parser/start-parsing', data);
            return response.data;
        },
        onSuccess: () => {
            setUrls('');
            setManualTaskName('');  // Очищаем правильное поле
            setProxies('');
            queryClient.invalidateQueries({queryKey: ['parsing-tasks']});
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (taskId: string) => {  // Изменено на string для UUID
            await api.delete(`/parser/tasks/${taskId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['parsing-tasks']});
        }
    });

    const handleFileUpload = () => {
        if (!selectedFile || !fileTaskName) return;

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('task_name', fileTaskName);  // Используем правильное поле
        if (fileProxies.trim()) {
            formData.append('proxy_list', fileProxies.trim());
        }

        uploadMutation.mutate(formData);
    };

    const handleStartParsing = () => {
        if (!urls || !manualTaskName) return;

        const urlList = urls.split('\n').map(u => u.trim()).filter(u => u);
        const proxyList = proxies.split('\n').map(p => p.trim()).filter(p => p);

        startParsingMutation.mutate({
            urls: urlList,
            task_name: manualTaskName,  // Используем правильное поле
            proxy_list: proxyList
        });
    };

    const handleDownload = (taskId: string, format: 'csv' | 'json') => {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        console.log('Скачивание с URL:', `${baseUrl}/parser/results/${taskId}?format=${format}`);
        window.open(`${baseUrl}/parser/results/${taskId}?format=${format}`, '_blank');
    };

    const handleDownloadExample = (format: 'json' | 'csv' | 'txt') => {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        window.open(`${baseUrl}/parser/example-files/${format}`, '_blank');
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'running':
                return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
            case 'failed':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            default:
                return <Clock className="w-5 h-5 text-gray-500" />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'completed': return 'Завершено';
            case 'running': return 'Выполняется';
            case 'failed': return 'Ошибка';
            case 'pending': return 'Ожидает';
            default: return status;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl">
                    <h1 className="text-2xl font-bold text-gray-900">Парсер профилей врачей</h1>
                    <p className="text-gray-600 text-sm">Автоматический сбор информации о врачах с использованием прокси</p>
                </div>

                {/* Help Section */}
                <div className="bg-blue-50/70 backdrop-blur-sm rounded-2xl p-4 border border-blue-200/50">
                    <div className="flex items-start space-x-3">
                        <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-blue-900 mb-2">Примеры файлов для загрузки:</h3>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => handleDownloadExample('json')}
                                    className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>Пример JSON</span>
                                </button>
                                <button
                                    onClick={() => handleDownloadExample('csv')}
                                    className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>Пример CSV</span>
                                </button>
                                <button
                                    onClick={() => handleDownloadExample('txt')}
                                    className="flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>Пример TXT</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Upload Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* File Upload */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Загрузка из файла</h2>

                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Название задачи"
                                value={fileTaskName}  // Используем отдельное состояние
                                onChange={(e) => setFileTaskName(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />

                            <div>
                                <input
                                    type="file"
                                    accept=".json,.csv,.txt"
                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="mt-2 text-xs text-gray-500 flex items-center">
                                    <button
                                        onClick={() => setShowFileHelp(!showFileHelp)}
                                        className="text-blue-500 hover:text-blue-700 flex items-center space-x-1"
                                    >
                                        <HelpCircle className="w-3 h-3" />
                                        <span>Форматы файлов</span>
                                    </button>
                                </div>
                                {showFileHelp && (
                                    <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                                        <p><strong>JSON:</strong> {"{"}"urls": ["url1", "url2"]{"}"}</p>
                                        <p><strong>CSV/TXT:</strong> По одному URL на строку</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <textarea
                                    placeholder="Прокси серверы (опционально)&#10;1710839beab92300:H4XREqdQ@res.geonix.com:10000&#10;http://proxy2.com:3128"
                                    value={fileProxies}
                                    onChange={(e) => setFileProxies(e.target.value)}
                                    rows={3}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                />
                                <div className="mt-1 text-xs text-gray-500">
                                    Разделяйте прокси запятыми или новой строкой
                                </div>
                            </div>

                            <button
                                onClick={handleFileUpload}
                                disabled={!selectedFile || !fileTaskName || uploadMutation.isPending}  // Изменено на isPending
                                className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
                            >
                                <Upload className="w-5 h-5" />
                                <span>{uploadMutation.isPending ? 'Загрузка...' : 'Загрузить и запустить'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Manual URLs */}
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Ручной ввод URL</h2>

                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Название задачи"
                                value={manualTaskName}  // Используем отдельное состояние
                                onChange={(e) => setManualTaskName(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />

                            <textarea
                                placeholder="Введите URL (по одному на строку)&#10;https://yandex.ru/search/?text=Иванов+врач+кардиолог&#10;https://yandex.ru/search/?text=Петров+врач+терапевт"
                                value={urls}
                                onChange={(e) => setUrls(e.target.value)}
                                rows={4}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />

                            <div>
                                <textarea
                                    placeholder="Прокси серверы (опционально)&#10;1710839beab92300:H4XREqdQ@res.geonix.com:10000&#10;http://user:pass@proxy1.com:8080&#10;socks5://proxy3.com:1080"
                                    value={proxies}
                                    onChange={(e) => setProxies(e.target.value)}
                                    rows={3}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                />
                                <div className="mt-2 text-xs text-gray-500 flex items-center">
                                    <button
                                        onClick={() => setShowProxyHelp(!showProxyHelp)}
                                        className="text-blue-500 hover:text-blue-700 flex items-center space-x-1"
                                    >
                                        <HelpCircle className="w-3 h-3" />
                                        <span>Форматы прокси</span>
                                    </button>
                                </div>
                                {showProxyHelp && (
                                    <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
                                        <p><strong>Базовые форматы:</strong></p>
                                        <p>• <code>proxy.com:8080</code></p>
                                        <p>• <code>192.168.1.1:3128</code></p>
                                        <p><strong>С авторизацией:</strong></p>
                                        <p>• <code>user:pass@proxy.com:8080</code></p>
                                        <p>• <code>1710839beab92300:H4XREqdQ@res.geonix.com:10000</code></p>
                                        <p><strong>С протоколом:</strong></p>
                                        <p>• <code>http://proxy.com:8080</code></p>
                                        <p>• <code>socks5://proxy.com:1080</code></p>
                                        <p>• <code>https://proxy.com:443</code></p>
                                        <div className="mt-2 pt-2 border-t border-gray-300">
                                            <p className="text-green-600 font-medium">✅ Ваш формат поддерживается!</p>
                                            <p><code>1710839beab92300:H4XREqdQ@res.geonix.com:10000</code></p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleStartParsing}
                                disabled={!urls || !manualTaskName || startParsingMutation.isPending}  // Изменено на isPending
                                className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
                            >
                                <Play className="w-5 h-5" />
                                <span>{startParsingMutation.isPending ? 'Запуск...' : 'Запустить парсинг'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tasks List */}
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/20 shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-800">Задачи парсинга</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-blue-50 border-b border-blue-200">
                            <tr>
                                <th className="text-left p-4 font-semibold text-gray-800">Task ID</th>
                                <th className="text-center p-4 font-semibold text-gray-800">Статус</th>
                                <th className="text-center p-4 font-semibold text-gray-800">Прогресс</th>
                                <th className="text-center p-4 font-semibold text-gray-800">Профили</th>
                                <th className="text-center p-4 font-semibold text-gray-800">Создана</th>
                                <th className="text-center p-4 font-semibold text-gray-800">Действия</th>
                            </tr>
                            </thead>

                            <tbody>
                            {tasks?.map((task) => (
                                <tr key={task.task_id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="p-4 font-medium text-gray-800">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-gray-900">{task.task_name}</span>
                                            <span className="text-xs text-gray-500 font-mono">{task.task_id}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            {getStatusIcon(task.status)}
                                            <span className="text-sm">{getStatusText(task.status)}</span>
                                        </div>
                                        {task.error_message && (
                                            <div className="mt-1 text-xs text-red-600 max-w-xs truncate" title={task.error_message}>
                                                {task.error_message}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center space-y-1">
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${task.progress_percentage}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-600">
                                                {task.processed_profiles}/{task.total_profiles} ({task.progress_percentage}%)
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center font-medium">{task.total_profiles}</td>
                                    <td className="p-4 text-center text-sm text-gray-600">
                                        <div className="flex flex-col">
                                            <span>{new Date(task.created_at).toLocaleDateString()}</span>
                                            <span className="text-xs">{new Date(task.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        {task.completed_at && (
                                            <div className="text-xs text-green-600 mt-1">
                                                Завершено: {new Date(task.completed_at).toLocaleTimeString()}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center space-x-2">
                                            {task.status === 'completed' && task.processed_profiles > 0 && (
                                                <>
                                                    <button
                                                        onClick={() => handleDownload(task.task_id, 'csv')}  // Используем task_id
                                                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                        title="Скачать CSV"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(task.task_id, 'json')}  // Используем task_id
                                                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                                        title="Скачать JSON"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => deleteMutation.mutate(task.task_id)}  // Используем task_id
                                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                title="Удалить задачу"
                                                disabled={deleteMutation.isPending}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {(!tasks || tasks.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        <div className="flex flex-col items-center space-y-2">
                                            <Clock className="w-8 h-8 text-gray-400" />
                                            <p>Задачи парсинга не найдены</p>
                                            <p className="text-sm">Создайте новую задачу, загрузив файл или введя URL вручную</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DoctorParser;