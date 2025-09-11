import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Select from "@/components/ui/Select";
import { listAuthors, type UserDto } from "@/lib/api";

interface UserSelectProps {
    value: string;
    onChange: (value: string | null) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export default function UserSelect({
                                       value,
                                       onChange,
                                       placeholder = "Выберите автора",
                                       className = "",
                                       disabled = false
                                   }: UserSelectProps) {
    const { data: users = [], isLoading } = useQuery<UserDto[]>({
        queryKey: ["users"],
        queryFn: listAuthors,
    });

    const userOptions = useMemo(() =>
            users.map(user => ({
                label: user.name || user.email,
                value: user.id
            })),
        [users]
    );

    return (
        <Select
            className={className}
            value={value}
            onChange={onChange}
            options={userOptions}
            placeholder={isLoading ? "Загрузка пользователей..." : placeholder}
            disabled={disabled || isLoading}
        />
    );
}
