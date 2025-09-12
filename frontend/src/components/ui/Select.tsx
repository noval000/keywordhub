"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

type Option = { label: string; value: string };

export default function Select({
                                   value, onChange, options, placeholder, className,
                               }: {
    value: string; onChange: (v: string) => void;
    options: Option[]; placeholder?: string; className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setHoveredIndex(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOptionSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setHoveredIndex(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            setHoveredIndex(null);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
        }
    };

    return (
        <div ref={containerRef} className="relative" style={{ zIndex: isOpen ? 999999 : 'auto' }}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                className={`${className} pr-10 py-3 bg-white/80 border-2 border-[var(--color-primary)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200 hover:border-[var(--color-primary)]/40 text-left w-full`}
            >
                <span className={selectedOption ? 'text-[var(--color-text)]' : 'text-gray-400'}>
                    {selectedOption ? selectedOption.label : (placeholder || "—")}
                </span>
            </button>

            <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--color-coffee-text)] hover:text-[var(--color-primary)] transition-colors duration-200 pointer-events-none ${isOpen ? 'rotate-180' : ''}`} />

            {isOpen && (
                <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-[var(--color-primary)]/20 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                    style={{ zIndex: 999999 }}
                >
                    <div className="py-1">
                        {/* Пустой вариант */}
                        <button
                            onClick={() => handleOptionSelect("")}
                            onMouseEnter={() => setHoveredIndex(-1)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            className="w-full text-left px-4 py-2 focus:outline-none transition-colors text-sm text-gray-400"
                            style={{
                                backgroundColor: hoveredIndex === -1 ? 'rgba(214, 0, 109, 0.1)' : 'transparent'
                            }}
                        >
                            {placeholder || "—"}
                        </button>

                        {/* Опции */}
                        {options.map((option, index) => (
                            <button
                                key={option.value}
                                onClick={() => handleOptionSelect(option.value)}
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                className="w-full text-left px-4 py-2 focus:outline-none transition-colors text-sm"
                                style={{
                                    backgroundColor: hoveredIndex === index || value === option.value
                                        ? 'rgba(214, 0, 109, 0.1)'
                                        : 'transparent',
                                    color: value === option.value ? 'var(--color-primary)' : 'var(--color-text)',
                                    fontWeight: value === option.value ? '500' : 'normal'
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}