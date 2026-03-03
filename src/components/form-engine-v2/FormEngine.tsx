import React, { useEffect, useCallback, memo } from 'react';
import { FormEngineProps, FormSchema, FieldSchema } from './types';
import { FieldRegistry } from './FieldRegistry';
import { FormProvider, useFormStore } from './store';
import { resolveCondition } from './logic';
import { validateField } from './validator';

// Tailwind Class Map (Static for JIT)
const colClassMap: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  6: "col-span-6",
  12: "col-span-12",
};

// Memoized Field Controller to prevent re-renders
const FieldController = memo(({ 
  field, 
  pathPrefix = '', 
  allValues, 
  setFieldValue, 
  getValue, 
  getError,
  readOnly 
}: {
  field: FieldSchema;
  pathPrefix?: string;
  allValues: any;
  setFieldValue: (path: string, val: any) => void;
  getValue: (path: string) => any;
  getError: (path: string) => string | undefined;
  readOnly?: boolean;
}) => {
  const currentPath = pathPrefix ? `${pathPrefix}.${field.id}` : field.id;
  
  // Logic: Condition Resolver with Context Awareness
  // We pass pathPrefix as context for relative paths inside arrays
  if (field.conditions && !resolveCondition(field.conditions, allValues, pathPrefix)) {
    return null;
  }

  if (field.hidden) return null;

  const colClass = colClassMap[field.gridCols || 12] || "col-span-12";
  const smColClass = colClassMap[field.gridCols || 6] || "col-span-6";

  // Logic: Array Field (Recursive)
  if (field.type === 'array' && field.arrayFields) {
      const items = getValue(currentPath) || [];
      
      return (
          <div key={currentPath} className="col-span-12 space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</label>
              {Array.isArray(items) && items.map((item: any, index: number) => (
                  <div key={index} className="border p-4 rounded-md relative bg-gray-50 dark:bg-gray-900">
                      <button 
                          type="button"
                          onClick={() => {
                              const newItems = [...items];
                              newItems.splice(index, 1);
                              setFieldValue(currentPath, newItems);
                          }}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-sm"
                      >
                          Remove
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                          {field.arrayFields?.map(subField => (
                            <FieldController
                              key={subField.id}
                              field={subField}
                              pathPrefix={`${currentPath}[${index}]`}
                              allValues={allValues}
                              setFieldValue={setFieldValue}
                              getValue={getValue}
                              getError={getError}
                              readOnly={readOnly}
                            />
                          ))}
                      </div>
                  </div>
              ))}
              <button
                  type="button"
                  onClick={() => setFieldValue(currentPath, [...items, {}])}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-500"
              >
                  + {field.addButtonLabel || "Add Item"}
              </button>
          </div>
      );
  }

  const Component = FieldRegistry[field.type] || FieldRegistry.text;

  return (
    <div key={currentPath} className={`${colClass} sm:${smColClass}`}>
      <Component
        field={{...field, readOnly: readOnly || field.readOnly}}
        value={getValue(currentPath)}
        onChange={(val: any) => setFieldValue(currentPath, val)}
        error={getError(currentPath)}
      />
    </div>
  );
}, (prev, next) => {
  // Custom Comparison for Performance Optimization
  // Only re-render if:
  // 1. Field definition changed (rare)
  // 2. Value for THIS field changed
  // 3. Error for THIS field changed
  // 4. Condition result changed (based on allValues)
  
  const currentPath = prev.pathPrefix ? `${prev.pathPrefix}.${prev.field.id}` : prev.field.id;
  const nextPath = next.pathPrefix ? `${next.pathPrefix}.${next.field.id}` : next.field.id;
  
  if (currentPath !== nextPath) return false;
  if (prev.readOnly !== next.readOnly) return false;

  // Check Value Change
  const prevValue = prev.getValue(currentPath);
  const nextValue = next.getValue(nextPath);
  if (prevValue !== nextValue) return false;

  // Check Error Change
  const prevError = prev.getError(currentPath);
  const nextError = next.getError(nextPath);
  if (prevError !== nextError) return false;

  // Check Condition Change (Expensive but necessary)
  if (prev.field.conditions) {
    const prevVisible = resolveCondition(prev.field.conditions, prev.allValues, prev.pathPrefix);
    const nextVisible = resolveCondition(next.field.conditions, next.allValues, next.pathPrefix);
    if (prevVisible !== nextVisible) return false;
  }

  // Check Array Items length (for array type)
  if (prev.field.type === 'array') {
      const prevItems = prev.getValue(currentPath);
      const nextItems = next.getValue(nextPath);
      if (Array.isArray(prevItems) && Array.isArray(nextItems)) {
          if (prevItems.length !== nextItems.length) return false;
          // Deep check items? No, children will update themselves if values passed down.
          // But we need to re-render array container if items change.
          // Since we checked value reference above, if array was mutated (bad) or replaced (good), we catch it.
          // But wait, if array item *content* changes, does array container need re-render?
          // Array container renders children. Children are FieldControllers.
          // Children depend on allValues.
          // If array container doesn't re-render, children don't re-render?
          // React.memo on Array Container:
          // If items array reference changed, we re-render.
          // If items array reference is SAME but content changed?
          // In immutable updates, content change = new array reference.
          // So reference check on `getValue(currentPath)` is sufficient.
      }
  }

  return true; // Props are equal enough to skip render
});


export const FormInner: React.FC<FormEngineProps> = ({ schema, onSubmit, onChange, readOnly }) => {
  const { state, setFieldValue, setErrors, getValue, getError } = useFormStore();

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      onChange(state.values);
    }
  }, [state.values, onChange]);

  const validateAll = useCallback(() => {
    let allErrors: Record<string, string> = {};
    
    // Recursive validation helper
    const validateSection = (fields: FieldSchema[], pathPrefix = '') => {
       fields.forEach(field => {
         // Check condition before validating?
         // Technically hidden fields shouldn't be validated?
         // User didn't specify, but usually yes.
         if (field.conditions && !resolveCondition(field.conditions, state.values, pathPrefix)) {
             return;
         }

         const fieldErrors = validateField(field, state.values, pathPrefix);
         Object.assign(allErrors, fieldErrors);
       });
    };

    schema.sections.forEach(section => {
      validateSection(section.fields);
    });

    setErrors(allErrors); // Dispatch to store
    return Object.keys(allErrors).length === 0;
  }, [schema, state.values, setErrors]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateAll()) {
      onSubmit(state.values);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {schema.sections.map(section => (
        <div key={section.id} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">{section.title}</h3>
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-12">
            {section.fields.map(field => (
              <FieldController
                key={field.id}
                field={field}
                allValues={state.values}
                setFieldValue={setFieldValue}
                getValue={getValue}
                getError={getError}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      ))}
      
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="submit"
            className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save
          </button>
        </div>
      )}
    </form>
  );
};

// Main Export
export const FormEngine: React.FC<FormEngineProps> = (props) => (
  <FormProvider initialValues={props.initialValues}>
    <FormInner {...props} />
  </FormProvider>
);
