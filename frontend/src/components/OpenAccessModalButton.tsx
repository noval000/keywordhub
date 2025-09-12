"use client";
import { useModal } from "@/app/providers/modal";
import GlobalAccessModal from "@/components/GlobalAccessModal";
import { ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/auth";

export default function OpenAccessModalButton() {
    // TODO: добавить проверку на роль админа, если есть в auth store
    const { open } = useModal();

    return (
        <button
            className="bg-[var(--color-coffee)] text-[var(--color-coffee-text)] hover:bg-[#b8a99f] hover:text-[var(--color-whte)] transition-colors duration-300 ease-in-out rounded-2xl px-4 py-2"
            onClick={() => open(<GlobalAccessModal />)}
        >
            <ShieldCheck className="size-4" />
        </button>
    );
}