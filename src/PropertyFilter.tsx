import React from 'react';
import { Input, Label } from './TechnicalConfiguration';

export interface Filter {
  property_name: string;
  property_data_type: 'string' | 'number' | 'datetime';
  property_operator: 'in' | 'not in' | '==' | '!=' | '>' | '<' | '>=' | '<=' | 'before' | 'after' | 'between';
  property_value: string | number;
  property_value_end?: string;
  attributeStorage: 'property' | 'node';
}

interface PropertyFilterProps {
  filter: Filter;
  index: number;
  onChange: (index: number, field: keyof Filter, value: string | number | undefined) => void;
  onRemove: (index: number) => void;
  isRemovable: boolean;
}

const PropertyFilter: React.FC<PropertyFilterProps> = ({ filter, index, onChange, onRemove, isRemovable }) => {
  // This generic handler is for simple inputs that map directly to a field
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onChange(index, name as keyof Filter, value);
  };

  // This specific handler is for the Data Type dropdown
  // It correctly resets the operator and values when the type changes
  const handleDataTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDataType = e.target.value as Filter['property_data_type'];
    onChange(index, 'property_data_type', newDataType);
    onChange(index, 'property_value', ''); // Reset value
    onChange(index, 'property_value_end', undefined); // Clear the end value

    // Set a sensible default operator for the new type
    let newOperator;
    if (newDataType === 'string') {
      newOperator = 'in';
    } else if (newDataType === 'number') {
      newOperator = '==';
    } else { // datetime
      newOperator = 'after';
    }
    onChange(index, 'property_operator', newOperator);
  };

  return (
    <div className="space-y-3 p-3 bg-black-50 dark:bg-black-750 rounded-lg border border-black-200 dark:border-black-600 relative">
      {isRemovable && (
        <button
          onClick={() => onRemove(index)}
          className="absolute top-2 right-2 text-black-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          aria-label="Remove filter"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </button>
      )}
      <div>
        <Label htmlFor={`property_name_${index}`}>Property Name:</Label>
        <Input id={`property_name_${index}`} type="text" name="property_name" value={filter.property_name} onChange={handleInputChange} placeholder="e.g., timestamp, status" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`property_data_type_${index}`}>Data Type:</Label>
          {/* FIXED: This now calls the correct handler */}
          <select id={`property_data_type_${index}`} name="property_data_type" value={filter.property_data_type} onChange={handleDataTypeChange} className="mt-1 block w-full px-3 py-2 bg-black dark:bg-black-700 border border-black-300 dark:border-black-600 rounded-md shadow-sm">
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="datetime">Datetime</option>
          </select>
        </div>
        <div>
          <Label htmlFor={`property_operator_${index}`}>Operator:</Label>
          <select id={`property_operator_${index}`} name="property_operator" value={filter.property_operator} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-black dark:bg-black-700 border border-black-300 dark:border-black-600 rounded-md shadow-sm">
            {filter.property_data_type === 'string' ? (
              <>
                <option value="in">is one of</option>
                <option value="not in">is not one of</option>
              </>
            ) : filter.property_data_type === 'number' ? (
              <>
                <option value="==">=</option>
                <option value="!=">!=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">≥</option>
                <option value="<=">≤</option>
              </>
            ) : ( /* Datetime Operators */
              <>
                <option value="after">is after</option>
                <option value="before">is before</option>
                <option value="between">is between</option>
              </>
            )}
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor={`property_value_${index}`}>
          Value(s)
          {filter.property_data_type === 'string' && <span className="text-black-500 text-xs"> (comma-separated)</span>}
        </Label>
        {filter.property_data_type === 'datetime' ? (
          <div className="flex flex-wrap items-center space-x-2">
            <Input
              id={`property_value_${index}`}
              type="datetime-local"
              name="property_value"
              value={String(filter.property_value)}
              onChange={handleInputChange}
              className="bg-black dark:bg-black-600"
            />
            {filter.property_operator === 'between' && (
              <>
                <span className="text-black-500 dark:text-black-400 text-sm">and</span>
                <Input
                  id={`property_value_end_${index}`}
                  type="datetime-local"
                  name="property_value_end" // This name correctly maps to the 'property_value_end' field in the Filter
                  value={filter.property_value_end || ''}
                  onChange={handleInputChange} // The generic handler works here because the 'name' attribute is correct
                  className="bg-black dark:bg-black-600"
                />
              </>
            )}
          </div>
        ) : (
          <Input
            id={`property_value_${index}`}
            type="text"
            name="property_value"
            value={String(filter.property_value)}
            onChange={handleInputChange}
            placeholder={filter.property_data_type === 'string' ? "e.g., Shipped,Delivered" : "e.g., 100"}
          />
        )}
      </div>
      <div>
        <Label htmlFor={`attributeStorage_${index}`}>Attribute Storage:</Label>
        <select id={`attributeStorage_${index}`} name="attributeStorage" value={filter.attributeStorage} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-black dark:bg-black-700 border border-black-300 dark:border-black-600 rounded-md shadow-sm">
          <option value="property">As properties on the node</option>
          <option value="node">As separate nodes</option>
        </select>
      </div>
    </div>
  );
};

export default PropertyFilter;