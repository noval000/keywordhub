"use client";

import { useState } from "react";

export default function ConfirmDeleteModal({
                                               onCancel,
                                               onConfirm,
                                           }: {
    onCancel: () => void;
    onConfirm: (hard: boolean) => void;
}) {
    const [hard, setHard] = useState(false);
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white w-[520px] rounded-2xl shadow-lg p-4">
                <div className="text-lg font-semibold mb-2">Удалить проект</div>
                <p className="text-sm text-slate-600 mb-3">
                    По умолчанию проект будет перемещён в архив (можно восстановить).<br/>
                    Включи «жёсткое удаление», чтобы удалить безвозвратно со всем ядром.
                </p>
                <label className="flex items-center gap-2 mb-3">
                    <input type="checkbox" checked={hard} onChange={e => setHard(e.target.checked)} />
                    <span className="text-sm text-red-700">Жёсткое удаление (необратимо)</span>
                </label>
                <div className="flex justify-end gap-2">
                    <button className="border rounded px-4 py-2" onClick={onCancel}>Отмена</button>
                    <button className="bg-red-600 text-white rounded px-4 py-2" onClick={() => onConfirm(hard)}>
                        Удалить
                    </button>
                </div>
            </div>
        </div>
    );
}
