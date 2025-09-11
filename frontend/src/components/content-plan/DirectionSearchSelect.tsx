import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface DirectionSearchSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

function DirectionSearchSelect({
                                   value,
                                   onChange,
                                   options,
                                   placeholder = "Выберите направление",
                                   disabled = false,
                                   className = ""
                               }: DirectionSearchSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [inputValue, setInputValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Синхронизируем input с внешним value
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // Фильтруем опции по поисковому запросу
    const filteredOptions = options.filter(option =>
        option.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Закрываем dropdown при клике вне компонента
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                !inputRef.current?.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setSearchTerm("");
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        setSearchTerm(newValue);
        setIsOpen(true);

        // Обновляем значение в родительском компоненте при каждом изменении
        onChange(newValue);
    };

    const handleOptionSelect = (option: string) => {
        setInputValue(option);
        onChange(option);
        setIsOpen(false);
        setSearchTerm("");
    };

    const handleInputFocus = () => {
        if (!disabled) {
            setIsOpen(true);
            setSearchTerm(inputValue);
        }
    };

    const handleInputBlur = () => {
        // Небольшая задержка чтобы успел сработать клик по опции
        setTimeout(() => {
            if (!dropdownRef.current?.matches(':hover')) {
                setIsOpen(false);
                setSearchTerm("");
            }
        }, 150);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            setSearchTerm("");
            inputRef.current?.blur();
        } else if (e.key === 'Enter' && filteredOptions.length === 1) {
            e.preventDefault();
            handleOptionSelect(filteredOptions[0]);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
            }
            // Можно добавить навигацию по стрелкам в будущем
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            // Можно добавить навигацию по стрелкам в будущем
        }
    };

    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className={`${className} pr-10 py-3 bg-white/80 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200 ${
                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                autoComplete="off"
            />

            {/* Стрелка dropdown */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={disabled}
                tabIndex={-1} // Убираем из tab navigation
            >
                <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown список */}
            {isOpen && !disabled && (
                <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto"
                >
                    {filteredOptions.length > 0 ? (
                        <div className="py-1">
                            {filteredOptions.map((option, index) => (
                                <button
                                    key={`${option}-${index}`}
                                    type="button"
                                    onClick={() => handleOptionSelect(option)}
                                    className="w-full text-left px-4 py-2 hover:bg-orange-50 focus:bg-orange-50 focus:outline-none transition-colors text-sm text-gray-900"
                                    onMouseDown={(e) => e.preventDefault()} // Предотвращаем blur при клике
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                            {searchTerm ? 'Направление не найдено' : 'Нет доступных направлений'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default DirectionSearchSelect;
