import { executeThingsURL } from '../lib/urlscheme.js';
import { ShowSchema } from '../types/mcp.js';
import { AbstractToolHandler } from '../lib/abstract-tool-handler.js';
class ShowToolHandler extends AbstractToolHandler {
    definitions = [
        {
            name: 'things_show',
            description: 'Navigate to a specific item or list in Things',
            schema: ShowSchema
        }
    ];
    async execute(toolName, params) {
        if (toolName !== 'things_show') {
            throw new Error(`Unknown tool: ${toolName}`);
        }
        await executeThingsURL('show', params);
        return params.id
            ? '🔍 Navigated to item in Things'
            : `🔍 Navigated to: ${params.query}`;
    }
}
export const showToolHandler = new ShowToolHandler();
export const showTools = showToolHandler.tools;
export const handleShow = showToolHandler.handle.bind(showToolHandler);
//# sourceMappingURL=show.js.map