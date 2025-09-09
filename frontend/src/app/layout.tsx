// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import Providers from "./providers";
import OpenAccessModalButton from "@/components/OpenAccessModalButton";
import {ModalProvider} from "@/app/providers/modal";
export const metadata = { title: "KeywordHub" };

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ru">
        <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
            <ModalProvider>
                <header className="border-b bg-white">
                    <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
                        <Link href="/" className="font-semibold">KeywordHub</Link>
                        <nav className="space-x-4 text-sm">
                            <Link href="/content-plan">Контент-план</Link>
                            <Link href="/cluster-registry">Семантика</Link>
                            <Link href="/projects">Проекты</Link>
                            <Link href="/analytics">Аналитика</Link>
                            <Link href="/parser">Парсинг врачей</Link>
                            <Link href="/login">Войти</Link>
                        </nav>
                        <OpenAccessModalButton/>
                    </div>
                </header>
                <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
            </ModalProvider>
        </Providers>
        </body>
        </html>
    );
}
