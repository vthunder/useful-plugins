import { z } from 'zod';
export function zodToJsonSchema(zodSchema) {
    let result;
    // Handle ZodEffects (refined schemas) by extracting the underlying schema
    if (zodSchema._def?.typeName === 'ZodEffects') {
        const underlyingSchema = zodSchema._def.schema;
        result = zodToJsonSchema(underlyingSchema);
    }
    else if (zodSchema instanceof z.ZodObject) {
        result = zodObjectToJsonSchema(zodSchema);
    }
    else if (zodSchema instanceof z.ZodString) {
        result = zodStringToJsonSchema(zodSchema);
    }
    else if (zodSchema instanceof z.ZodNumber) {
        result = zodNumberToJsonSchema(zodSchema);
    }
    else if (zodSchema instanceof z.ZodBoolean) {
        result = { type: 'boolean' };
    }
    else if (zodSchema instanceof z.ZodArray) {
        result = zodArrayToJsonSchema(zodSchema);
    }
    else if (zodSchema instanceof z.ZodOptional) {
        result = zodToJsonSchema(zodSchema.unwrap());
    }
    else if (zodSchema instanceof z.ZodEnum) {
        result = zodEnumToJsonSchema(zodSchema);
    }
    else if (zodSchema instanceof z.ZodUnion) {
        result = zodUnionToJsonSchema(zodSchema);
    }
    else if (zodSchema instanceof z.ZodLiteral) {
        result = {
            type: typeof zodSchema.value,
            enum: [zodSchema.value]
        };
    }
    else {
        // Fallback for unsupported types
        result = { type: 'string' };
    }
    // Extract description from Zod schema if available
    const zodTypeDef = zodSchema._def;
    if (zodTypeDef?.description) {
        result.description = zodTypeDef.description;
    }
    return result;
}
function zodObjectToJsonSchema(zodObject) {
    const shape = zodObject.shape;
    const properties = {};
    const required = [];
    for (const [key, zodType] of Object.entries(shape)) {
        const jsonSchema = zodToJsonSchema(zodType);
        // Extract description from Zod schema if available
        const zodTypeDef = zodType._def;
        if (zodTypeDef?.description) {
            jsonSchema.description = zodTypeDef.description;
        }
        properties[key] = jsonSchema;
        if (!zodType.isOptional()) {
            required.push(key);
        }
    }
    return {
        type: 'object',
        properties,
        ...(required.length > 0 && { required })
    };
}
function zodStringToJsonSchema(zodString) {
    const schema = { type: 'string' };
    // Extract constraints
    const checks = zodString._def.checks || [];
    for (const check of checks) {
        switch (check.kind) {
            case 'min':
                schema.minLength = check.value;
                break;
            case 'max':
                schema.maxLength = check.value;
                break;
            case 'regex':
                // Could add pattern support here
                break;
        }
    }
    return schema;
}
function zodNumberToJsonSchema(zodNumber) {
    const schema = { type: 'number' };
    // Extract constraints
    const checks = zodNumber._def.checks || [];
    for (const check of checks) {
        switch (check.kind) {
            case 'min':
                schema.minimum = check.value;
                break;
            case 'max':
                schema.maximum = check.value;
                break;
        }
    }
    return schema;
}
function zodArrayToJsonSchema(zodArray) {
    return {
        type: 'array',
        items: zodToJsonSchema(zodArray.element)
    };
}
function zodEnumToJsonSchema(zodEnum) {
    return {
        type: 'string',
        enum: zodEnum.options
    };
}
function zodUnionToJsonSchema(zodUnion) {
    const options = zodUnion.options.map((option) => zodToJsonSchema(option));
    // If all options have the same type, merge them
    const types = [...new Set(options.map((opt) => opt.type))];
    if (types.length === 1) {
        const baseSchema = { type: types[0] };
        // Merge enum values if all are enums
        const allEnums = options.every((opt) => opt.enum);
        if (allEnums) {
            baseSchema.enum = options.flatMap((opt) => opt.enum || []);
        }
        return baseSchema;
    }
    return { anyOf: options };
}
//# sourceMappingURL=schema-utils.js.map