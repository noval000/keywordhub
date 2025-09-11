// app/login/page.tsx
'use client';  // Указываем, что это клиентский компонент

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";  // Получаем хранилище для авторизации
import { api } from "@/lib/api"; // Для работы с API
import { useRouter } from "next/navigation"; // Для редиректа

export default function LoginPage() {
    const { token, setToken, setUser } = useAuthStore((s) => s);  // Получаем хранилище
    const router = useRouter();  // Для редиректа

    useEffect(() => {
        if (token) {
            router.push("/projects");  // Перенаправляем на страницу проектов
        }
    }, [token, router]);

    const [username, setUsername] = useState("admin@example.com");
    const [password, setPassword] = useState("StrongPass123!");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const onLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr(null);
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("username", username.trim());
            params.set("password", password);
            const response = await api.post("/auth/login", params, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });

            const token = response.data.access_token;
            setToken(token);  // Сохраняем токен в Zustand

            // Запрашиваем данные о пользователе
            const userResponse = await api.get("/auth/me", {
                headers: {
                    Authorization: `Bearer ${token}`,  // Отправляем токен для аутентификации
                },
            });

            console.log('User Data:', userResponse.data);  // Логируем данные о пользователе

            // Сохраняем данные пользователя в Zustand
            setUser(userResponse.data);

            // Редирект на страницу проектов
            router.push("/projects");

        } catch (e: any) {
            setErr(e?.response?.data?.detail ?? "Ошибка входа");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6">
            <h1 className="text-xl font-semibold mb-4">Вход</h1>
            <form onSubmit={onLogin} className="space-y-3">
                <div>
                    <label className="text-sm">Email</label>
                    <input
                        className="w-full border rounded px-3 py-2"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>
                <div>
                    <label className="text-sm">Пароль</label>
                    <input
                        type="password"
                        className="w-full border rounded px-3 py-2"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
                {err && <div className="text-red-600 text-sm">{err}</div>}
                <button disabled={loading} className="bg-slate-900 text-white rounded px-4 py-2">
                    {loading ? "Вход..." : "Войти"}
                </button>
                <p className="text-xs text-slate-500">
                    Нет пользователя? Сначала зарегистрируйся через Swagger: POST /auth/register
                </p>
            </form>
        </div>
    );
}