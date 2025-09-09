export interface PageTypeAnalytics {
    page_type: string;
    // Основные метрики
    total_themes: number;           // Кол-во тем в контент-плане
    registry_clusters: number;      // Кол-во в реестре кластеров
    tz_ready: number;              // Кол-во готовых ТЗ
    prod_published: number;        // Кол-во опубликованных страниц

    // Вычисляемые проценты
    percentage_of_total: number;   // % от общего числа тем
    tz_progress: number;          // % готовности ТЗ (tz_ready / total_themes * 100)
    prod_progress: number;        // % публикации (prod_published / total_themes * 100)
    registry_coverage: number;    // % покрытия реестром (registry_clusters / total_themes * 100)
}

export interface DirectionAnalytics {
    direction: string;
    total_themes: number;
    registry_clusters: number;
    tz_ready: number;
    prod_published: number;
    percentage_of_total: number;
    tz_progress: number;
    prod_progress: number;
    registry_coverage: number;
}

export interface AnalyticsReport {
    page_types: PageTypeAnalytics[];
    directions: DirectionAnalytics[];
    totals: {
        total_themes: number;
        registry_clusters: number;
        tz_ready: number;
        prod_published: number;
        avg_tz_progress: number;
        avg_prod_progress: number;
        avg_registry_coverage: number;
    };
}