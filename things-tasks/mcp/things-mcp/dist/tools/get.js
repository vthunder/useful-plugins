import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { executeAppleScriptFile } from '../lib/applescript.js';
import { parseTodoList, parseProjectList, parseAreaList, parseTagList, parseTodoDetails } from '../lib/parser.js';
import { GetProjectSchema, GetAreaSchema, GetListSchema, GetListByNameSchema, GetTodoDetailsSchema } from '../types/mcp.js';
import { AbstractToolHandler } from '../lib/abstract-tool-handler.js';
function getThingsDbPath() {
    const base = join(homedir(), 'Library', 'Group Containers', 'JLMPQHK86H.com.culturedcode.ThingsMac');
    try {
        const entries = readdirSync(base);
        const dataDir = entries.find(e => e.startsWith('ThingsData-'));
        if (!dataDir)
            return null;
        return join(base, dataDir, 'Things Database.thingsdatabase', 'main.sqlite');
    }
    catch {
        return null;
    }
}
function getChecklistItems(todoId) {
    const dbPath = getThingsDbPath();
    if (!dbPath)
        return [];
    try {
        const query = `SELECT title, status FROM TMChecklistItem WHERE task = '${todoId.replace(/'/g, "''")}' ORDER BY "index" ASC;`;
        const output = execSync(`sqlite3 "${dbPath}" ${JSON.stringify(query)}`, { timeout: 5000 }).toString().trim();
        if (!output)
            return [];
        return output.split('\n').map(line => {
            const sep = line.lastIndexOf('|');
            const title = sep === -1 ? line : line.slice(0, sep);
            const statusStr = sep === -1 ? '' : line.slice(sep + 1);
            return { title, completed: statusStr === '3' };
        }).filter(item => item.title);
    }
    catch {
        return [];
    }
}
class GetToolHandler extends AbstractToolHandler {
    definitions = [
        {
            name: 'things_get_inbox',
            description: 'Get all to-dos in the Inbox',
            schema: GetListSchema
        },
        {
            name: 'things_get_today',
            description: 'Get all to-dos scheduled for Today',
            schema: GetListSchema
        },
        {
            name: 'things_get_upcoming',
            description: 'Get all scheduled to-dos (with dates)',
            schema: GetListSchema
        },
        {
            name: 'things_get_anytime',
            description: 'Get all to-dos in Anytime',
            schema: GetListSchema
        },
        {
            name: 'things_get_someday',
            description: 'Get all to-dos in Someday',
            schema: GetListSchema
        },
        {
            name: 'things_get_logbook',
            description: 'Get all completed to-dos in the Logbook',
            schema: GetListSchema
        },
        {
            name: 'things_get_trash',
            description: 'Get all deleted to-dos in the Trash',
            schema: GetListSchema
        },
        {
            name: 'things_get_projects',
            description: 'Get all active projects',
            schema: GetListSchema
        },
        {
            name: 'things_get_areas',
            description: 'Get all areas',
            schema: GetListSchema
        },
        {
            name: 'things_get_tags',
            description: 'Get all tags',
            schema: GetListSchema
        },
        {
            name: 'things_get_project',
            description: 'Get all to-dos in a specific project',
            schema: GetProjectSchema
        },
        {
            name: 'things_get_area',
            description: 'Get all items in a specific area',
            schema: GetAreaSchema
        },
        {
            name: 'things_get_list',
            description: 'Get all to-dos from a specific list by name',
            schema: GetListByNameSchema
        },
        {
            name: 'things_get_todo_details',
            description: 'Get detailed information about a specific to-do including deadline, notes, status, etc.',
            schema: GetTodoDetailsSchema
        }
    ];
    scriptMap = {
        'things_get_inbox': 'get-inbox',
        'things_get_today': 'get-today',
        'things_get_upcoming': 'get-upcoming',
        'things_get_anytime': 'get-anytime',
        'things_get_someday': 'get-someday',
        'things_get_logbook': 'get-logbook',
        'things_get_trash': 'get-trash',
        'things_get_projects': 'get-projects',
        'things_get_areas': 'get-areas',
        'things_get_tags': 'get-tags',
        'things_get_project': 'get-project-todos',
        'things_get_area': 'get-area-items',
        'things_get_todo_details': 'get-todo-details'
    };
    listNameToScript = {
        'inbox': 'get-inbox',
        'today': 'get-today',
        'upcoming': 'get-upcoming',
        'anytime': 'get-anytime',
        'someday': 'get-someday',
        'logbook': 'get-logbook',
        'trash': 'get-trash'
    };
    async execute(toolName, params) {
        let scriptName;
        // Handle the get_list tool separately
        if (toolName === 'things_get_list') {
            const listParams = params;
            scriptName = this.listNameToScript[listParams.list];
            if (!scriptName) {
                throw new Error(`Unknown list: ${listParams.list}`);
            }
        }
        else {
            scriptName = this.scriptMap[toolName];
            if (!scriptName) {
                throw new Error(`Unknown tool: ${toolName}`);
            }
        }
        let scriptArgs = [];
        const options = { maxResults: params.max_results };
        // Handle specific tools that need arguments
        if (toolName === 'things_get_project') {
            const projectParams = params;
            scriptArgs = [projectParams.project_id];
        }
        else if (toolName === 'things_get_area') {
            const areaParams = params;
            scriptArgs = [areaParams.area_id];
        }
        else if (toolName === 'things_get_todo_details') {
            const todoParams = params;
            scriptArgs = [todoParams.id];
            // Don't pass maxResults for todo details since it's a single item
            delete options.maxResults;
        }
        const output = await executeAppleScriptFile(scriptName, scriptArgs, options);
        // Return empty array for empty output
        if (!output.trim()) {
            const emptyResult = toolName.includes('project') || toolName.includes('area')
                ? { todos: [] }
                : { [this.getResultKey(toolName)]: [] };
            return JSON.stringify(emptyResult, null, 2);
        }
        // Parse based on tool type
        let result;
        switch (toolName) {
            case 'things_get_projects':
                result = { projects: parseProjectList(output) };
                break;
            case 'things_get_areas':
                result = { areas: parseAreaList(output) };
                break;
            case 'things_get_tags':
                result = { tags: parseTagList(output) };
                break;
            case 'things_get_todo_details': {
                const details = parseTodoDetails(output);
                const checklistItems = getChecklistItems(details.id);
                if (checklistItems.length > 0)
                    details.checklistItems = checklistItems;
                result = details;
                break;
            }
            default:
                result = { todos: parseTodoList(output) };
        }
        return JSON.stringify(result, null, 2);
    }
    getResultKey(toolName) {
        if (toolName.includes('project'))
            return 'projects';
        if (toolName.includes('area'))
            return 'areas';
        if (toolName.includes('tag'))
            return 'tags';
        return 'todos';
    }
}
export const getToolHandler = new GetToolHandler();
export const getTools = getToolHandler.tools;
export const handleGet = getToolHandler.handle.bind(getToolHandler);
//# sourceMappingURL=get.js.map