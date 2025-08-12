// src/AutocompleteInput.tsx
import React, { useState, ChangeEvent, useRef, useEffect } from 'react';

interface AutocompleteInputProps {
    inputId: string;
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
    inputId,
    value,
    onChange,
    suggestions,
    placeholder,
}) => {
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    console.log(suggestions);


    useEffect(() => {
        // Close suggestions when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const userInput = e.currentTarget.value;
        onChange(userInput); // Update parent state immediately

        if (userInput) {
            const newFilteredSuggestions = suggestions.filter(
                (suggestion) =>
                    suggestion.toLowerCase().indexOf(userInput.toLowerCase()) > -1
            );
            setFilteredSuggestions(newFilteredSuggestions);
            setShowSuggestions(true);
            setActiveSuggestionIndex(-1); // Reset active suggestion
        } else {
            setFilteredSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const onClick = (suggestion: string) => {
        onChange(suggestion); // Update parent state with selected suggestion
        setFilteredSuggestions([]);
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (showSuggestions && filteredSuggestions.length) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission if any
                if (activeSuggestionIndex > -1 && activeSuggestionIndex < filteredSuggestions.length) {
                    onClick(filteredSuggestions[activeSuggestionIndex]);
                } else if (filteredSuggestions.length > 0) {
                    // If no active suggestion but suggestions exist, pick the first one or just use current input
                    // For now, let's just use the current input if enter is pressed without explicit selection
                    setShowSuggestions(false); // Hide suggestions
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (activeSuggestionIndex === -1) { // No suggestion selected
                    setActiveSuggestionIndex(filteredSuggestions.length - 1);
                } else {
                    setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (activeSuggestionIndex === -1) { // No suggestion selected
                    setActiveSuggestionIndex(0);
                } else {
                    setActiveSuggestionIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
                }
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
                setActiveSuggestionIndex(-1);
            }
        }
    };
    console.log(showSuggestions, value, filteredSuggestions);

    const suggestionsListComponent = showSuggestions && value && filteredSuggestions.length > 0 && (
        <ul className="suggestions-list">
            {filteredSuggestions.map((suggestion, index) => (
                <li
                    key={suggestion}
                    onClick={() => onClick(suggestion)}
                    className={index === activeSuggestionIndex ? 'suggestion-active' : ''}
                >
                    {suggestion}
                </li>
            ))}
        </ul>
    );

    console.log(suggestionsListComponent);


    return (
        <div className="autocomplete-container" ref={inputRef}>
            <input
                id={inputId}
                type="text"
                onChange={handleChange}
                onKeyDown={onKeyDown}
                value={value}
                placeholder={placeholder}
                autoComplete="off" // Important to prevent browser's own autocomplete
            />
            {suggestionsListComponent}
        </div>
    );
};

export default AutocompleteInput;
