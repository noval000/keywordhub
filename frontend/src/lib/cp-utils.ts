// Месяц → "MM, месяц" по-русски
export function formatPeriodRuFromMonthInput(value: string): string | null {
    // value из <input type="month">, формат "YYYY-MM"
    if (!value) return null;
    const [y, m] = value.split("-");
    const month = Number(m);
    if (!month || month < 1 || month > 12) return null;
    const names = [
        "январь","февраль","март","апрель","май","июнь",
        "июль","август","сентябрь","октябрь","ноябрь","декабрь"
    ];
    const ru = names[month - 1];
    return `${m}, ${ru}`;
}

// Обратное преобразование: "09, сентябрь" → "YYYY-09" (берём текущий или ближайший год)
export function toMonthInputFromPeriod(period?: string | null): string {
    if (!period) return "";
    const m = period.split(",")[0]?.trim();
    const mm = (m && m.length === 1) ? `0${m}` : m;
    const now = new Date();
    const yyyy = String(now.getFullYear());
    return (mm && /^\d{2}$/.test(mm)) ? `${yyyy}-${mm}` : "";
}

export function normalizeUrl(u?: string | null): string | null {
    if (!u) return null;
    const s = u.trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
}

// "1000 (1250)" → { value: 1000, display: "1000 (1250)" }
export function parseCharsDisplay(input?: string): { value: number | null; display: string } {
    const s = (input ?? "").trim();
    if (!s) return { value: null, display: "" };
    const match = s.match(/^(\d+)(?:\s*\(\s*(\d+)\s*\))?$/);
    if (!match) {
        // если пользователь ввёл что-то своё — попробуем хотя бы первое число достать
        const first = (s.match(/\d+/)?.[0]) ?? "";
        return { value: first ? Number(first) : null, display: s };
    }
    const rec = Number(match[1]);
    return { value: rec, display: s };
}

// МЕТА SEO: простой парсер "H1: ...\nTitle: ...\nDescription: ..."
export type MetaSeo = { h1: string; title: string; description: string };
export function parseMetaSeo(src?: string | null): MetaSeo {
    const text = (src ?? "").trim();
    const res: MetaSeo = { h1: "", title: "", description: "" };
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        const m = line.match(/^\s*(H1|Title|Description)\s*:\s*(.*)$/i);
        if (m) {
            const key = m[1].toLowerCase();
            const val = m[2].trim();
            if (key === "h1") res.h1 = val;
            else if (key === "title") res.title = val;
            else if (key === "description") res.description = val;
        }
    }
    if (!res.h1 && !res.title && !res.description && text) {
        // старые записи — положим целиком в description
        res.description = text;
    }
    return res;
}

export function buildMetaSeo(meta: MetaSeo): string | null {
    const lines: string[] = [];
    if (meta.h1) lines.push(`H1: ${meta.h1}`);
    if (meta.title) lines.push(`Title: ${meta.title}`);
    if (meta.description) lines.push(`Description: ${meta.description}`);
    const out = lines.join("\n").trim();
    return out || null;
}

// Красивый бейджик-ссылки (верни className)
export function linkBadgeClass() {
    return "inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md border bg-slate-50 " +
        "border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 truncate";
}
