export type TZBlockType = 'H1' | 'H2' | 'H3' | 'H4' | 'paragraph' | 'list' | 'conclusion';

export type TZBlock = {
    id: string;
    type: TZBlockType;
    title: string;                    // Название блока (H1: Центр ментального здоровья)
    description: string[];            // Массив пунктов описания
    collapsed: boolean;               // Свернут ли блок
}

export type TZData = {
    id?: string;
    content_plan_id: string;
    title: string;
    author: string;
    blocks: TZBlock[];               // Блоки H1, H2, H3 и т.д.

    // Отдельные глобальные поля для всего ТЗ:
    keywords: string[];              // Ключевые фразы
    count: number | null;           // Количество символов
    usage_form: string;             // В какой форме использовать
    lsi_phrases: string[];          // LSI фразы
    competitors: string[];          // Конкуренты (URLs)

    created_at?: string;
    updated_at?: string;
}

export type TZCreateRequest = Omit<TZData, 'id' | 'created_at' | 'updated_at'>;
export type TZUpdateRequest = Partial<TZCreateRequest> & { id: string };