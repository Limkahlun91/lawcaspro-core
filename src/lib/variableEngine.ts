import { formatCurrency, formatDate } from "@/utils/formatters";

// Define the Context Interface
export interface VariableContext {
  spa_price?: number;
  approved_purchase_price?: number;
  balance_sum?: number;
  purchaser_names?: string[];
  borrower_names?: string[];
  bank_name?: string;
  project_name?: string;
  developer_name?: string;
  building_type?: string;
  unit_type?: string;
  unit_no?: string;
  file_no?: string;
  today?: Date;
  [key: string]: any;
}

/**
 * Enterprise Variable Replacement Engine
 * Replaces {{key}} in template string with values from context.
 * Supports basic formatting implicitly via helper functions if we extend it.
 */
export const replaceVariables = (template: string, context: VariableContext): string => {
  if (!template) return "";

  return template.replace(/\{\{([\w_]+)\}\}/g, (match, key) => {
    const value = context[key];

    if (value === undefined || value === null) {
      return `[MISSING: ${key}]`;
    }

    // Auto-Format based on key name convention
    if (key.endsWith('_price') || key.endsWith('_sum') || key.endsWith('_amount') || key.endsWith('_fee')) {
      return formatCurrency(Number(value));
    }

    if (key.endsWith('_date') || key === 'today') {
      return formatDate(value);
    }

    if (Array.isArray(value)) {
      return value.join(" & ");
    }

    return String(value);
  });
};

// Test Helper
export const testVariableEngine = () => {
  const template = "Dear {{purchaser_names}}, price is {{spa_price}} for {{project_name}}.";
  const context = {
    purchaser_names: ["Ali", "Abu"],
    spa_price: 500000,
    project_name: "Eco Grandeur"
  };
  console.log("Variable Engine Test:", replaceVariables(template, context));
};
