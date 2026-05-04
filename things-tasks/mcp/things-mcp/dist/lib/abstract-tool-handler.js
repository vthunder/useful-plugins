import { z } from 'zod';
import { ThingsError } from './errors.js';
import { zodToJsonSchema } from './schema-utils.js';
export class AbstractToolHandler {
    get tools() {
        return this.definitions.map(def => {
            const schema = zodToJsonSchema(def.schema);
            return {
                name: def.name,
                description: def.description,
                inputSchema: {
                    type: 'object',
                    properties: schema.properties || {},
                    ...(schema.required && { required: schema.required })
                }
            };
        });
    }
    async handle(toolName, args) {
        try {
            const definition = this.definitions.find(def => def.name === toolName);
            if (!definition) {
                return this.handleError(new Error(`Unknown tool: ${toolName}`));
            }
            const params = definition.schema.parse(args);
            const result = await this.execute(toolName, params);
            return this.formatResponse(result);
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    formatResponse(message) {
        return {
            content: [
                {
                    type: "text",
                    text: message
                }
            ]
        };
    }
    handleError(error) {
        let errorMessage;
        if (error instanceof z.ZodError) {
            errorMessage = `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`;
        }
        else if (error instanceof ThingsError) {
            errorMessage = error.message;
        }
        else if (error instanceof Error) {
            errorMessage = error.message;
        }
        else {
            errorMessage = 'An unexpected error occurred';
        }
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: errorMessage
                }
            ]
        };
    }
}
//# sourceMappingURL=abstract-tool-handler.js.map