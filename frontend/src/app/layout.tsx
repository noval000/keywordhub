// app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";
import Link from "next/link";
import Providers from "./providers";
import OpenAccessModalButton from "@/components/OpenAccessModalButton";
import { ModalProvider } from "@/app/providers/modal";
import { metadata } from "./metadata";  // Импортируем метаданные для сервера
import ClientAuth from "@/components/ClientAuth";  // Импортируем клиентский компонент для логики авторизации

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ru">
        <head>
            {/* Серверные метаданные */}
            <title>{metadata.title}</title>
            <meta name="description" content={metadata.description} />
        </head>
        <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
            <ModalProvider>

                <ClientAuth />

                <main className="mx-auto max-w-8xl px-4 py-6">{children}</main>
            </ModalProvider>
        </Providers>
        </body>
        </html>
    );
}