import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TagInputProps {
  tags: string[];
  allExistingTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  placeholder?: string;
}

export function TagInput({ tags, allExistingTags, onAddTag, onRemoveTag, placeholder = "Add tag..." }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = allExistingTags.filter(
        t => t.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(t)
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    setHighlightedIndex(-1);
  }, [inputValue, allExistingTags, tags]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        onAddTag(suggestions[highlightedIndex]);
        setInputValue('');
      } else if (inputValue.trim()) {
        onAddTag(inputValue.trim());
        setInputValue('');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="grid gap-2" ref={containerRef}>
      <div className="flex flex-wrap gap-2 min-h-[1.5rem]">
        {tags.map(tag => (
          <Badge key={tag} variant="secondary" className="flex items-center gap-1 px-2 py-0.5 animate-in fade-in zoom-in duration-200">
            {tag}
            <X className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" onClick={() => onRemoveTag(tag)} />
          </Badge>
        ))}
      </div>
      <div className="flex gap-2 relative">
        <Input 
          placeholder={placeholder}
          value={inputValue} 
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.trim() && suggestions.length > 0 && setShowSuggestions(true)}
        />
        <Button 
          type="button" 
          variant="outline" 
          size="icon" 
          onClick={() => {
            if (inputValue.trim()) {
              onAddTag(inputValue.trim());
              setInputValue('');
            }
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>

        {showSuggestions && (
          <div className="absolute top-full left-0 w-full mt-1 bg-popover border rounded-md shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="max-h-40 overflow-y-auto p-1">
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion}
                  className={cn(
                    "px-3 py-1.5 text-sm cursor-pointer rounded-sm transition-colors",
                    index === highlightedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                  onClick={() => {
                    onAddTag(suggestion);
                    setInputValue('');
                    setShowSuggestions(false);
                  }}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
