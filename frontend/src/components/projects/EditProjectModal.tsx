"use client";

import { useState } from "react";
import { updateProject } from "@/lib/api";

export default function EditProjectModal({
                                             id,
                                             initial,
                                             onClose,
                                             onSaved,
                                         }: {
    id: string;
    initial: { name: string; region?: string; domain?: string; is_archived: boolean };
    onClose: () => void;
    onSaved: (p: { name: string; region?: string; domain?: string; is_archived: boolean }) => void;
}) {
    const [name, setName] = useState(initial.name);
    const [region, setRegion] = useState(initial.region ?? "");
    const [domain, setDomain] = useState(initial.domain ?? "");
    const [isArchived, setIsArchived] = useState(initial.is_archived);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const save = async () => {
        if (!name.trim()) { setErr("Название не может быть пустым"); return; }
        setLoading(true); setErr(null);
        try {
            const upd = await updateProject(id, {
                name: name.trim(),
                region: region.trim() || undefined,
                domain: domain.trim() || undefined,
                is_archived: isArchived,
            });
            onSaved(upd);
        } catch (e: any) {
            setErr(e?.response?.data?.detail || "Не удалось сохранить");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white w-[520px] rounded-2xl shadow-lg p-4">
                <div className="text-lg font-semibold mb-3">Редактировать проект</div>
                <div className="space-y-3">
                    <div>
                        <div className="text-sm text-slate-600 mb-1">Название</div>
                        <input className="w-full border rounded px-3 py-2" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div>
                        <div className="text-sm text-slate-600 mb-1">Регион</div>
                        <input className="w-full border rounded px-3 py-2" value={region} onChange={e => setRegion(e.target.value)} placeholder="Москва / СПб ..." />
                    </div>
                    <div>
                        <div className="text-sm text-slate-600 mb-1">Домен</div>
                        <input className="w-full border rounded px-3 py-2" value={domain} onChange={e => setDomain(e.target.value)} placeholder="example.com" />
                    </div>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={isArchived} onChange={e => setIsArchived(e.target.checked)} />
                        <span className="text-sm">Архивировать проект</span>
                    </label>
                    {err && <div className="text-red-600 text-sm">{err}</div>}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                    <button className="border rounded px-4 py-2" onClick={onClose}>Отмена</button>
                    <button className="bg-slate-900 text-white rounded px-4 py-2" onClick={save} disabled={loading}>
                        {loading ? "Сохранение..." : "Сохранить"}
                    </button>
                </div>
            </div>
        </div>
    );
}
