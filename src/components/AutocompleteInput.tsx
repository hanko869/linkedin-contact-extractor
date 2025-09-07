'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface AutocompleteInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (event: KeyboardEvent<HTMLInputElement>) => void;
  suggestions: string[];
  maxSuggestions?: number;
}

export default function AutocompleteInput({
  placeholder,
  value,
  onChange,
  onKeyPress,
  suggestions,
  maxSuggestions = 8
}: AutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input value
  useEffect(() => {
    if (!value.trim()) {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const lowerInput = value.toLowerCase();
    
    // First, find exact matches at the beginning
    const exactMatches = suggestions.filter(suggestion => 
      suggestion.toLowerCase().startsWith(lowerInput)
    );
    
    // Then, find matches anywhere in the string
    const containsMatches = suggestions.filter(suggestion => 
      suggestion.toLowerCase().includes(lowerInput) && 
      !suggestion.toLowerCase().startsWith(lowerInput)
    );
    
    // Combine and limit results
    const filtered = [...exactMatches, ...containsMatches]
      .slice(0, maxSuggestions)
      .sort((a, b) => a.length - b.length);

    setFilteredSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setActiveSuggestionIndex(-1);
  }, [value, suggestions, maxSuggestions]);

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      onKeyPress(e);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      case 'Enter':
        if (activeSuggestionIndex >= 0) {
          e.preventDefault();
          handleSuggestionClick(filteredSuggestions[activeSuggestionIndex]);
        } else {
          onKeyPress(e);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
        break;
      default:
        onKeyPress(e);
        break;
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    inputRef.current?.focus();
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow click events
    setTimeout(() => {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }, 150);
  };

  const handleFocus = () => {
    if (filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`px-3 py-2 cursor-pointer text-sm ${
                index === activeSuggestionIndex
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}