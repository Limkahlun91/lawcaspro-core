/**
 * Evaluate a single rule against an entity (e.g., Payment Voucher)
 * @param {Object} rule - The rule object containing the condition
 * @param {Object} entity - The entity to check against
 * @returns {boolean} - True if the condition is met
 */
export function evaluateRule(rule, entity) {
    if (!rule.condition) return false;
    
    const { field, operator, value } = rule.condition;
    // Check if field exists on entity. If not, maybe it's a nested field or we return false.
    // For simplicity, assume flat structure or handle basic undefined.
    const actual = entity[field];

    if (actual === undefined || actual === null) {
        // If the field is missing, the rule cannot be evaluated as true.
        // Unless operator is checking for null? For now, fail safe.
        return false;
    }

    // Convert value to number if comparing numbers
    const numActual = Number(actual);
    const numValue = Number(value);
    const isNumber = !isNaN(numActual) && !isNaN(numValue);

    switch (operator) {
        case 'gt': return isNumber ? numActual > numValue : actual > value;
        case 'gte': return isNumber ? numActual >= numValue : actual >= value;
        case 'lt': return isNumber ? numActual < numValue : actual < value;
        case 'lte': return isNumber ? numActual <= numValue : actual <= value;
        case 'eq': return isNumber ? numActual === numValue : actual === value;
        case 'neq': return isNumber ? numActual !== numValue : actual !== value;
        case 'contains': return String(actual).includes(value);
        default:
            console.warn(`[RuleEngine] Unsupported operator: ${operator}`);
            return false;
    }
}

/**
 * Get the set of required roles based on all matching rules.
 * @param {Array} rules - List of approval_rules
 * @param {Object} entity - The entity to check (e.g. PV object)
 * @returns {string[]} - Array of unique required roles (e.g. ['partner', 'founder'])
 */
export function getRequiredRoles(rules, entity) {
    let matchedRoles = [];
    let hasMatch = false;

    if (!rules || rules.length === 0) return [];

    for (const rule of rules) {
        try {
            if (evaluateRule(rule, entity)) {
                if (rule.required_roles && Array.isArray(rule.required_roles)) {
                    // Normalize roles to lowercase
                    const normalizedRoles = rule.required_roles.map(r => r.toLowerCase());
                    matchedRoles.push(...normalizedRoles);
                    hasMatch = true;
                }
            }
        } catch (e) {
            console.error(`[RuleEngine] Error evaluating rule ${rule.id}:`, e);
        }
    }

    // If no rules matched, what is the default?
    // Policy: "Implicit Deny" or "Implicit Allow"?
    // Usually, if no specific high-value rule matches, we might fall back to a base role.
    // BUT the caller (approve.js) might have a hardcoded base requirement (e.g. Partner).
    // The Rule Engine adds *additional* constraints.
    // So we return the specific roles triggered by data conditions.
    
    return [...new Set(matchedRoles)];
}
