"use client";
import { useEffect, useState } from "react";
import { MetaSeo, parseMetaSeo, buildMetaSeo } from "@/lib/cp-utils";

export default function MetaSeoEditor({
                                          value, onChange,
                                      }: {
    value: string | null;
    onChange: (v: string | null) => void;
}) {
    const [meta, setMeta] = useState<MetaSeo>({ h1: "", title: "", description: "" });

    useEffect(() => { setMeta(parseMetaSeo(value)); }, [value]);

    const set = (k: keyof MetaSeo, v: string) => {
        const next = { ...meta, [k]: v };
        setMeta(next);
        onChange(buildMetaSeo(next));
    };

    return (
        <div className="col-span-2 border rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium text-slate-700">МЕТА SEO</div>
            <input className="border rounded px-3 py-2 w-full" placeholder="H1"
                   value={meta.h1} onChange={e=>set("h1", e.target.value)} />
            <input className="border rounded px-3 py-2 w-full" placeholder="Title"
                   value={meta.title} onChange={e=>set("title", e.target.value)} />
            <textarea className="border rounded px-3 py-2 w-full" placeholder="Description"
                      rows={3} value={meta.description} onChange={e=>set("description", e.target.value)} />
        </div>
    );
}
