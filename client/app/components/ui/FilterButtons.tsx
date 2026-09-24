import { Button } from "rizzui";

interface FilterOption {
  key: string;
  label: string;
}

interface FilterButtonsProps<T extends string> {
  options: FilterOption[];
  activeFilter: T;
  onFilterChange: (filter: T) => void;
}

export const FilterButtons = <T extends string>({
  options,
  activeFilter,
  onFilterChange,
}: FilterButtonsProps<T>) => {
  return (
    <div className="flex gap-2">
      {options.map(({ key, label }) => (
        <Button
          key={key}
          variant={activeFilter === key ? "solid" : "outline"}
          size="sm"
          onClick={() => onFilterChange(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
};
