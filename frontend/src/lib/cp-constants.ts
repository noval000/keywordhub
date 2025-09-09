export const SECTION_OPTIONS = [
    "услуга",
    "специальность",
    "заболевание",
    "симптом",
    "блог",
] as const;

export const STATUS_OPTIONS = [
    "ТЗ в разработке",
    "ТЗ готово",
    "В работе",
    "Можно размещать",
    "Внести СЕО правки",
    "Отправлено на размещение",
    "Размещено",
] as const;

export type SectionOption = typeof SECTION_OPTIONS[number];
export type StatusOption = typeof STATUS_OPTIONS[number];
