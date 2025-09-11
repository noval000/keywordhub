import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthState = {
    token: string | null;
    user: { name: string } | null; // Добавляем поле для данных пользователя
    setToken: (t: string) => void;
    setUser: (user: { name: string }) => void;  // Функция для установки данных пользователя
    logout: () => void;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            setToken: (t) => set({ token: t }),
            setUser: (user) => set({ user }),
            logout: () => set({ token: null }),
        }),
        { name: "kh-auth" }
    )
);
