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
            className="inline-flex items-center gap-1 border border-slate-200 rounded px-3 py-1 text-sm hover:bg-slate-50"
            onClick={() => open(<GlobalAccessModal />)}
        >
            <ShieldCheck className="size-4" />
        </button>
    );
}