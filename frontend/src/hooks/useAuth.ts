"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";  // Используем состояние из хранилища
import { api } from "@/lib/api";  // Импортируем api для запросов к серверу

export const useAuth = () => {
    const { token, setToken, logout } = useAuthStore();  // Получаем из хранилища токен, setToken и logout
    const [loading, setLoading] = useState(true);  // Состояние загрузки данных
    const [user, setUser] = useState<any | null>(null);  // Данные пользователя

    // Загружаем данные пользователя при изменении токена
    useEffect(() => {
        const fetchUser = async () => {
            if (token) {
                try {
                    // Запрос для получения данных о текущем пользователе
                    const response = await api.get("/auth/me");
                    setUser(response.data);  // Сохраняем данные пользователя в state
                } catch (err) {
                    console.error("Failed to fetch user", err);
                    setUser(null);  // В случае ошибки сбрасываем данные пользователя
                } finally {
                    setLoading(false);  // Завершаем загрузку
                }
            } else {
                setLoading(false);  // Если нет токена, сразу завершаем загрузку
            }
        };

        fetchUser();
    }, [token]);

    return { user, loading, setToken, logout };
};