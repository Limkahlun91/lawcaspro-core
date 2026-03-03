import React, { createContext, useContext, useReducer, useEffect } from 'react';
import set from 'lodash.set';
import get from 'lodash.get';

// State Definition
interface FormState {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

// Actions
type FormAction =
  | { type: 'SET_VALUE'; path: string; value: any }
  | { type: 'SET_ERROR'; path: string; error: string }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
  | { type: 'SET_TOUCHED'; path: string }
  | { type: 'RESET'; values: Record<string, any> };

// Reducer
const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'SET_VALUE': {
      // Use structuredClone for deep copy (Performance fix over JSON.parse)
      const newValues = typeof structuredClone === 'function' 
        ? structuredClone(state.values) 
        : JSON.parse(JSON.stringify(state.values));
      set(newValues, action.path, action.value);
      return { ...state, values: newValues };
    }
    case 'SET_ERROR': {
      const newErrors = { ...state.errors, [action.path]: action.error };
      if (!action.error) delete newErrors[action.path];
      return { ...state, errors: newErrors };
    }
    case 'SET_ERRORS': {
      return { ...state, errors: action.errors };
    }
    case 'SET_TOUCHED': {
      return { ...state, touched: { ...state.touched, [action.path]: true } };
    }
    case 'RESET': {
      return { values: action.values, errors: {}, touched: {} };
    }
    default:
      return state;
  }
};

// Context
interface FormContextType {
  state: FormState;
  setFieldValue: (path: string, value: any) => void;
  setFieldError: (path: string, error: string) => void;
  setErrors: (errors: Record<string, string>) => void;
  setFieldTouched: (path: string) => void;
  getValue: (path: string) => any;
  getError: (path: string) => string | undefined;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

// Provider Component
export const FormProvider: React.FC<{ initialValues?: any; children: React.ReactNode }> = ({ initialValues = {}, children }) => {
  const [state, dispatch] = useReducer(formReducer, {
    values: initialValues,
    errors: {},
    touched: {}
  });

  // Re-initialize if initialValues prop changes
  useEffect(() => {
    dispatch({ type: 'RESET', values: initialValues });
  }, [initialValues]);

  const setFieldValue = (path: string, value: any) => {
    dispatch({ type: 'SET_VALUE', path, value });
  };

  const setFieldError = (path: string, error: string) => {
    dispatch({ type: 'SET_ERROR', path, error });
  };

  const setErrors = (errors: Record<string, string>) => {
    dispatch({ type: 'SET_ERRORS', errors });
  };

  const setFieldTouched = (path: string) => {
    dispatch({ type: 'SET_TOUCHED', path });
  };

  const getValue = (path: string) => get(state.values, path);
  const getError = (path: string) => state.errors[path]; // Simple flat error map for now

  return (
    <FormContext.Provider value={{ state, setFieldValue, setFieldError, setErrors, setFieldTouched, getValue, getError }}>
      {children}
    </FormContext.Provider>
  );
};

// Hook
export const useFormStore = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormStore must be used within a FormProvider');
  }
  return context;
};
