/**
 * Production Safety Layer
 * Bank-grade validation for legal document generation.
 */

export class ProductionValidator {
    constructor() {}

    /**
     * 1. Required Field Pre-Validation (Configuration Check)
     * Checks if all required fields have a variable mapped or a static value.
     * @param {Array} mappings - Array of field mapping objects
     * @returns {Object} { isValid: boolean, error: string | null }
     */
    validateConfiguration(mappings) {
        const invalidFields = mappings.filter(m => 
            m.is_required && !m.variable_key && !m.static_value
        );

        if (invalidFields.length > 0) {
            const names = invalidFields.map(f => f.pdf_field_name).join(', ');
            return {
                isValid: false,
                error: `Configuration Error: The following required fields are not mapped to a variable or static value: ${names}`
            };
        }

        return { isValid: true, error: null };
    }

    /**
     * 2. Runtime Null Check & 3. Field Length Protection
     * Validates data against mappings before generation.
     * @param {Array} mappings - Array of field mapping objects
     * @param {Object} data - The aggregated case data
     * @returns {Object} { isValid: boolean, error: string | null }
     */
    validateRuntimeData(mappings, data) {
        for (const m of mappings) {
            // Determine the value to be used
            let value = m.static_value;
            if (m.variable_key) {
                value = data[m.variable_key];
            }

            // 2. Runtime Null Check
            if (m.is_required) {
                if (value === undefined || value === null || value === '') {
                    return {
                        isValid: false,
                        error: `Runtime Error: Required field "${m.pdf_field_name}" is missing data for variable "${m.variable_key}".`
                    };
                }
            }

            // 3. Field Length Protection
            if (value && typeof value === 'string' && m.max_length) {
                if (value.length > m.max_length) {
                    return {
                        isValid: false,
                        error: `Safety Violation: Value for "${m.pdf_field_name}" (${value.length} chars) exceeds PDF field limit (${m.max_length} chars). Value: "${value.substring(0, 10)}..."`
                    };
                }
            }
        }

        return { isValid: true, error: null };
    }
}
