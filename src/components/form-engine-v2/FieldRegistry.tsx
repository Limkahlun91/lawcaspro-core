import React from 'react';
import { FieldSchema } from './types';

// Basic Field Components
const TextField: React.FC<{ field: FieldSchema; value: any; onChange: (val: any) => void; error?: string }> = ({ field, value, onChange, error }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label} {field.validation?.some(v => v.type === 'required') && '*'}</label>
    <input
      type="text"
      className={`px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:border-gray-700 ${error ? 'border-red-500' : 'border-gray-300'}`}
      placeholder={field.placeholder}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={field.disabled}
      readOnly={field.readOnly}
    />
    {error && <span className="text-xs text-red-500">{error}</span>}
  </div>
);

const NumberField: React.FC<{ field: FieldSchema; value: any; onChange: (val: any) => void; error?: string }> = ({ field, value, onChange, error }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label} {field.validation?.some(v => v.type === 'required') && '*'}</label>
    <input
      type="number"
      className={`px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:border-gray-700 ${error ? 'border-red-500' : 'border-gray-300'}`}
      placeholder={field.placeholder}
      value={value || ''}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      disabled={field.disabled}
      readOnly={field.readOnly}
    />
    {error && <span className="text-xs text-red-500">{error}</span>}
  </div>
);

const SelectField: React.FC<{ field: FieldSchema; value: any; onChange: (val: any) => void; error?: string }> = ({ field, value, onChange, error }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label} {field.validation?.some(v => v.type === 'required') && '*'}</label>
    <select
      className={`px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:border-gray-700 ${error ? 'border-red-500' : 'border-gray-300'}`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={field.disabled}
    >
      <option value="">Select...</option>
      {field.options?.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {error && <span className="text-xs text-red-500">{error}</span>}
  </div>
);

const DateField: React.FC<{ field: FieldSchema; value: any; onChange: (val: any) => void; error?: string }> = ({ field, value, onChange, error }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label} {field.validation?.some(v => v.type === 'required') && '*'}</label>
    <input
      type="date"
      className={`px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:border-gray-700 ${error ? 'border-red-500' : 'border-gray-300'}`}
      value={value ? new Date(value).toISOString().split('T')[0] : ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={field.disabled}
    />
    {error && <span className="text-xs text-red-500">{error}</span>}
  </div>
);

// Registry
export const FieldRegistry: Record<string, React.FC<any>> = {
  text: TextField,
  number: NumberField,
  currency: NumberField, // Reuse for now
  date: DateField,
  select: SelectField,
  // Add others as needed
};
