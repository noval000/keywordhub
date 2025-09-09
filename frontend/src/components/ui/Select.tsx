"use client";
type Option = { label: string; value: string };

export default function Select({
                                   value, onChange, options, placeholder, className,
                               }: {
    value: string; onChange: (v: string) => void;
    options: Option[]; placeholder?: string; className?: string;
}) {
    return (
        <select
            className={`border rounded px-3 py-2 ${className || ""}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            <option value="">{placeholder || "—"}</option>
            {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}
