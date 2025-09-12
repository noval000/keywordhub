'use client';  // Указываем, что это клиентский компонент

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";  // Используем Zustand для авторизации
import { useRouter } from "next/navigation";  // Для редиректа
import Link from "next/link";
import OpenAccessModalButton from "@/components/OpenAccessModalButton";
import '../app/globals.css'


export default function ClientAuth() {
    const { token, logout, user } = useAuthStore((state) => state);  // Получаем данные о пользователе из Zustand хранилища
    const router = useRouter();  // Для редиректа

    const handleLogout = () => {
        logout();  // Очищаем токен из хранилища
        router.push("/login");  // Перенаправляем на страницу входа
    };

    return (
        <header className="bg-rose">
            {token ? (
                    <div className="mx-auto max-w-8xl px-4 py-6 h-20 p-2 flex items-center justify-between">
                        <Link href="/" className="font-semibold">
                            <img src="/images/logo-fomin.svg" alt="Logo"/>
                        </Link>
                        <nav className="space-x-4 text-sm text-all">
                            <Link href="/content-plan">Контент-план</Link>
                            <Link href="/cluster-registry">Семантика</Link>
                            <Link href="/projects">Проекты</Link>
                            <Link href="/analytics">Аналитика</Link>
                            <Link href="/parser">Парсинг врачей</Link>
                        </nav>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-slate-900">{user?.name}</span> {/* Имя пользователя */}
                            <button
                                onClick={handleLogout}
                                className="text-[var(--color-primary)] bg-transparent border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:text-[var(--color-whte)] transition-colors duration-300 ease-in-out rounded-3xl px-4 py-2"
                            >
                                Выйти
                            </button>
                            {/* Если пользователь суперпользователь, показываем соответствующий текст */}
                            {user?.is_superuser && <OpenAccessModalButton/>}
                        </div>
                    </div>

            ) : (
                <></>

            )}
        </header>
    );
}