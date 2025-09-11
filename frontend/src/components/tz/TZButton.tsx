// components/tz/TZButton.tsx
import React from 'react';
import { FileText, Plus } from 'lucide-react';
import type { CPItem } from '@/lib/api';

interface TZButtonProps {
    item: CPItem;
    onCreateTZ: (contentPlanId: string) => void;
    onEditTZ: (tzId: string) => void;
}

export const TZButton: React.FC<TZButtonProps> = ({
                                                      item,
                                                      onCreateTZ,
                                                      onEditTZ
                                                  }) => {
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('TZButton clicked:', {
            id: item.id,
            has_technical_specification: item.has_technical_specification,
            technical_specification_id: item.technical_specification_id
        });

        if (item.has_technical_specification && item.technical_specification_id) {
            console.log('Editing TZ:', item.technical_specification_id);
            onEditTZ(item.technical_specification_id);
        } else {
            console.log('Creating TZ for item:', item.id);
            onCreateTZ(item.id);
        }
    };

    if (item.has_technical_specification && item.technical_specification_id) {
        return (
            <button
                onClick={handleClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs transition-colors"
                title="Редактировать техническое задание"
            >
                <FileText size={14} />
                Редактировать ТЗ
            </button>
        );
    }

    return (
        <button
            onClick={handleClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs transition-colors"
            title="Создать техническое задание"
        >
            <Plus size={14} />
            Создать ТЗ
        </button>
    );
};