"use client";

import { useParams } from 'next/navigation';
import AnalyticsReport from '@/components/AnalyticsReport';

export default function ProjectAnalyticsPage() {
    const params = useParams<{ id: string }>();

    return <AnalyticsReport projectId={params.id} />;
}