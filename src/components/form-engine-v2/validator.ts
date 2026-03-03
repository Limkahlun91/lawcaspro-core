import { FieldSchema, ValidationRule } from './types';
import get from 'lodash.get';

// 3. Recursive Validator
export const validateField = (field: FieldSchema, values: any, pathPrefix: string = ''): Record<string, string> => {
  const errors: Record<string, string> = {};
  const currentPath = pathPrefix ? `${pathPrefix}.${field.id}` : field.id;
  const value = get(values, currentPath);

  // 1. Validate Self
  if (field.validation) {
    for (const rule of field.validation) {
      if (rule.type === 'required') {
        if (value === undefined || value === null || value === '') {
          errors[currentPath] = rule.message;
          break; // Stop at first error
        }
      }
      // Add other rules (min, max, regex) here
    }
  }

  // 2. Recursive Validation for Arrays
  if (field.type === 'array' && field.arrayFields && Array.isArray(value)) {
    value.forEach((item, index) => {
      field.arrayFields!.forEach(subField => {
        const subErrors = validateField(subField, values, `${currentPath}[${index}]`);
        Object.assign(errors, subErrors);
      });
    });
  }

  return errors;
};
