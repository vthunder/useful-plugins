import { z } from 'zod';
export interface JsonSchema {
    type?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema;
    enum?: any[];
    anyOf?: JsonSchema[];
    description?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
}
export declare function zodToJsonSchema(zodSchema: z.ZodType): JsonSchema;
//# sourceMappingURL=schema-utils.d.ts.map