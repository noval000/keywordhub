// Месяц → "MM, месяц" по-русски
export function formatPeriodRuFromMonthInput(monthInput: string): string | null {
    if (!monthInput) return null;

    // monthInput приходит в формате "2024-09"
    const [year, month] = monthInput.split('-');
    if (!year || !month) return null;

    // Возвращаем в формате "09.2024"
    return `${month}.${year}`;
}

export function toMonthInputFromPeriod(period?: string | null): string {
    if (!period) return "";

    // Если период в формате "09.2024"
    if (period.includes('.')) {
        const [month, year] = period.split('.');
        if (month && year) {
            return `${year}-${month}`;
        }
    }

    // Если период в старом формате "сентябрь 2024" - конвертируем
    const monthMap: Record<string, string> = {
        'январь': '01', 'февраль': '02', 'март': '03', 'апрель': '04',
        'май': '05', 'июнь': '06', 'июль': '07', 'август': '08',
        'сентябрь': '09', 'октябрь': '10', 'ноябрь': '11', 'декабрь': '12'
    };

    for (const [monthName, monthNum] of Object.entries(monthMap)) {
        if (period.toLowerCase().includes(monthName)) {
            const yearMatch = period.match(/\d{4}/);
            if (yearMatch) {
                return `${yearMatch[0]}-${monthNum}`;
            }
        }
    }

    return "";
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
