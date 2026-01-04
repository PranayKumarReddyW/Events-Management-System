import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "@/lib/utils";

export interface Option {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  className,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleUnselect = (item: string) => {
    onChange(selected.filter((s) => s !== item));
  };

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectables = options.filter(
    (option) => !selected.includes(option.value)
  );

  return (
    <Command className={cn("overflow-visible bg-transparent", className)}>
      <div
        className={cn(
          "group border border-input px-3 py-3 sm:py-2.5 text-sm ring-offset-background rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled && "bg-muted opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex gap-1.5 sm:gap-1 flex-wrap">
          {selected.map((value) => {
            const option = options.find((o) => o.value === value);
            return (
              <Badge
                key={value}
                variant="secondary"
                className="rounded-sm px-2 py-1 sm:px-1.5 sm:py-0.5 font-normal text-sm sm:text-xs"
              >
                {option?.label || value}
                <button
                  className={cn(
                    "ml-1.5 sm:ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 inline-flex items-center justify-center p-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-0",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={disabled}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !disabled) {
                      handleUnselect(value);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => {
                    if (!disabled) {
                      handleUnselect(value);
                    }
                  }}
                  aria-label={`Remove ${option?.label || value}`}
                >
                  <X className="h-4 w-4 sm:h-3 sm:w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            );
          })}
          <CommandPrimitive.Input
            ref={inputRef}
            disabled={disabled}
            value=""
            onBlur={() => setOpen(false)}
            onFocus={() => {
              if (!disabled) {
                setOpen(true);
              }
            }}
            placeholder={selected.length === 0 ? placeholder : undefined}
            className={cn(
              "ml-0 sm:ml-2 bg-transparent outline-none placeholder:text-muted-foreground flex-1 min-w-[120px] py-1.5 sm:py-0",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
        </div>
      </div>
      <div className="relative mt-2">
        {open && selectables.length > 0 ? (
          <div className="absolute w-full z-10 top-0 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
            <CommandGroup className="h-full overflow-auto max-h-48 sm:max-h-56 md:max-h-64">
              {selectables.map((option) => {
                return (
                  <CommandItem
                    key={option.value}
                    onMouseDown={(e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onSelect={() => {
                      handleSelect(option.value);
                      inputRef.current?.focus();
                    }}
                    className="cursor-pointer py-3 sm:py-2.5 text-base sm:text-sm min-h-[44px] sm:min-h-0"
                  >
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ) : null}
      </div>
    </Command>
  );
}
