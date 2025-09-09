"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";

const ModalContext = createContext<{
    open: (content: ReactNode) => void;
    close: () => void;
} | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
    const [content, setContent] = useState<ReactNode | null>(null);

    const open = (c: ReactNode) => setContent(c);
    const close = () => setContent(null);

    return (
        <ModalContext.Provider value={{ open, close }}>
            {children}
            {content && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow-lg p-6 max-w-lg w-full">
                        {content}
                    </div>
                </div>
            )}
        </ModalContext.Provider>
    );
}

export function useModal() {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error("useModal must be used inside ModalProvider");
    return ctx;
}
