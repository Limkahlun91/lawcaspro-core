import { FieldCondition } from './types';
import get from 'lodash.get';

// 5. Condition Resolver (Independent Module)
export const resolveCondition = (conditions: FieldCondition[] | undefined, values: any, contextPath?: string): boolean => {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every(cond => {
    // 2. Path Resolver (Use lodash.get for nested paths)
    // Priority: Context Path (Relative) -> Root Path (Absolute)
    let val = undefined;
    
    if (contextPath) {
        val = get(values, `${contextPath}.${cond.field}`);
    }

    // If val is undefined, it might be a root field reference
    if (val === undefined) {
        val = get(values, cond.field);
    }
    
    switch (cond.operator) {
      case 'eq': return val === cond.value;
      case 'neq': return val !== cond.value;
      case 'contains': 
        if (Array.isArray(val)) return val.includes(cond.value);
        if (typeof val === 'string') return val.includes(String(cond.value));
        return false;
      case 'gt': return Number(val) > Number(cond.value);
      case 'lt': return Number(val) < Number(cond.value);
      default: return true;
    }
  });
};
