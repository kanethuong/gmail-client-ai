import { Search, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch?: () => void;
  placeholder?: string;
  isSearching?: boolean;
}

export function SearchBar({
  searchQuery,
  onSearchChange,
  onSearch,
  placeholder = "Search mail (subject, from, snippet)",
  isSearching = false
}: SearchBarProps) {
  const handleClear = () => {
    onSearchChange("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch();
    }
  };

  return (
    <div className="max-w-2xl flex-1">
      <div className="relative">
        <Search className={`text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform ${isSearching ? 'animate-pulse' : ''}`} />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyPress={handleKeyPress}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute top-1/2 right-1 h-6 w-6 p-0 -translate-y-1/2 transform hover:bg-muted"
            title="Clear search"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}