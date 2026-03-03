// Level 9: Phase 1 - Form Architecture Core Types

export type FieldType = 
  | 'text' 
  | 'number' 
  | 'currency' 
  | 'date' 
  | 'select' 
  | 'multi-select' 
  | 'checkbox' 
  | 'textarea' 
  | 'json'
  | 'upload'
  | 'array'; // Added 'array' type for Field Arrays

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'email' | 'regex' | 'custom';
  value?: any;
  message: string;
}

export interface FieldCondition {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
  value: any;
}

export interface FieldSchema {
  id: string; // Unique key for the field (e.g., 'spa_price')
  label: string;
  type: FieldType;
  placeholder?: string;
  defaultValue?: any;
  options?: { label: string; value: any }[]; // For select types
  validation?: ValidationRule[];
  hidden?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  conditions?: FieldCondition[]; // Conditional rendering
  gridCols?: 1 | 2 | 3 | 4 | 6 | 12; // Layout control
  group?: string; // For grouping fields in UI
  
  // Field Array Support
  arrayFields?: FieldSchema[]; // Definition for fields inside an array item
  addButtonLabel?: string; // e.g. "Add Purchaser"
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FieldSchema[];
  expanded?: boolean;
}

export interface FormSchema {
  id: string;
  title: string;
  sections: FormSection[];
}

// Engine Props
export interface FormEngineProps {
  schema: FormSchema;
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void;
  onChange?: (values: Record<string, any>) => void;
  readOnly?: boolean;
}
