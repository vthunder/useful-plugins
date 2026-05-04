import { z } from 'zod';
export declare const AddTodoSchema: z.ZodObject<{
    title: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    when: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["today", "tomorrow", "evening", "anytime", "someday"]>, z.ZodString, z.ZodString]>>;
    deadline: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    checklist_items: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    list_id: z.ZodOptional<z.ZodString>;
    list: z.ZodOptional<z.ZodString>;
    heading: z.ZodOptional<z.ZodString>;
    completed: z.ZodOptional<z.ZodBoolean>;
    canceled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title: string;
    completed?: boolean | undefined;
    canceled?: boolean | undefined;
    heading?: string | undefined;
    tags?: string[] | undefined;
    checklist_items?: string[] | undefined;
    notes?: string | undefined;
    when?: string | undefined;
    deadline?: string | undefined;
    list?: string | undefined;
    list_id?: string | undefined;
}, {
    title: string;
    completed?: boolean | undefined;
    canceled?: boolean | undefined;
    heading?: string | undefined;
    tags?: string[] | undefined;
    checklist_items?: string[] | undefined;
    notes?: string | undefined;
    when?: string | undefined;
    deadline?: string | undefined;
    list?: string | undefined;
    list_id?: string | undefined;
}>;
export declare const AddProjectSchema: z.ZodObject<{
    title: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    when: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["today", "tomorrow", "evening", "anytime", "someday"]>, z.ZodString, z.ZodString]>>;
    deadline: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    area_id: z.ZodOptional<z.ZodString>;
    area: z.ZodOptional<z.ZodString>;
    items: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"todo">;
        title: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
        when: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["today", "tomorrow", "evening", "anytime", "someday"]>, z.ZodString, z.ZodString]>>;
        deadline: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        completed: z.ZodOptional<z.ZodBoolean>;
        canceled: z.ZodOptional<z.ZodBoolean>;
        checklist: z.ZodOptional<z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            completed: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            completed: boolean;
            title: string;
        }, {
            title: string;
            completed?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            completed: boolean;
            title: string;
        }[] | undefined;
    }, {
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            title: string;
            completed?: boolean | undefined;
        }[] | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"heading">;
        title: z.ZodString;
        archived: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        type: "heading";
        title: string;
        archived: boolean;
    }, {
        type: "heading";
        title: string;
        archived?: boolean | undefined;
    }>]>, "many">>;
    completed: z.ZodOptional<z.ZodBoolean>;
    canceled: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title: string;
    completed?: boolean | undefined;
    canceled?: boolean | undefined;
    tags?: string[] | undefined;
    items?: ({
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            completed: boolean;
            title: string;
        }[] | undefined;
    } | {
        type: "heading";
        title: string;
        archived: boolean;
    })[] | undefined;
    notes?: string | undefined;
    when?: string | undefined;
    deadline?: string | undefined;
    area?: string | undefined;
    area_id?: string | undefined;
}, {
    title: string;
    completed?: boolean | undefined;
    canceled?: boolean | undefined;
    tags?: string[] | undefined;
    items?: ({
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            title: string;
            completed?: boolean | undefined;
        }[] | undefined;
    } | {
        type: "heading";
        title: string;
        archived?: boolean | undefined;
    })[] | undefined;
    notes?: string | undefined;
    when?: string | undefined;
    deadline?: string | undefined;
    area?: string | undefined;
    area_id?: string | undefined;
}>;
export declare const ShowSchema: z.ZodEffects<z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
    filter: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    id?: string | undefined;
    filter?: string[] | undefined;
    query?: string | undefined;
}, {
    id?: string | undefined;
    filter?: string[] | undefined;
    query?: string | undefined;
}>, {
    id?: string | undefined;
    filter?: string[] | undefined;
    query?: string | undefined;
}, {
    id?: string | undefined;
    filter?: string[] | undefined;
    query?: string | undefined;
}>;
export declare const GetListByNameSchema: z.ZodObject<{
    list: z.ZodEnum<["inbox", "today", "upcoming", "anytime", "someday", "logbook", "trash"]>;
    max_results: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    list: "today" | "anytime" | "someday" | "inbox" | "upcoming" | "logbook" | "trash";
    max_results?: number | undefined;
}, {
    list: "today" | "anytime" | "someday" | "inbox" | "upcoming" | "logbook" | "trash";
    max_results?: number | undefined;
}>;
export declare const GetProjectSchema: z.ZodObject<{
    project_id: z.ZodString;
    max_results: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    max_results?: number | undefined;
}, {
    project_id: string;
    max_results?: number | undefined;
}>;
export declare const GetAreaSchema: z.ZodObject<{
    area_id: z.ZodString;
    max_results: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    area_id: string;
    max_results?: number | undefined;
}, {
    area_id: string;
    max_results?: number | undefined;
}>;
export declare const GetListSchema: z.ZodObject<{
    max_results: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    max_results?: number | undefined;
}, {
    max_results?: number | undefined;
}>;
export declare const GetTodoDetailsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const UpdateTodoJSONSchema: z.ZodObject<{
    title: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    when: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["today", "tomorrow", "evening", "anytime", "someday"]>, z.ZodString, z.ZodString]>>;
    deadline: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    checklist_items: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    list_id: z.ZodOptional<z.ZodString>;
    list: z.ZodOptional<z.ZodString>;
    heading: z.ZodOptional<z.ZodString>;
    completed: z.ZodOptional<z.ZodBoolean>;
    canceled: z.ZodOptional<z.ZodBoolean>;
} & {
    id: z.ZodString;
    operation: z.ZodDefault<z.ZodLiteral<"update">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    operation: "update";
    title: string;
    completed?: boolean | undefined;
    canceled?: boolean | undefined;
    heading?: string | undefined;
    tags?: string[] | undefined;
    checklist_items?: string[] | undefined;
    notes?: string | undefined;
    when?: string | undefined;
    deadline?: string | undefined;
    list?: string | undefined;
    list_id?: string | undefined;
}, {
    id: string;
    title: string;
    completed?: boolean | undefined;
    canceled?: boolean | undefined;
    heading?: string | undefined;
    tags?: string[] | undefined;
    checklist_items?: string[] | undefined;
    operation?: "update" | undefined;
    notes?: string | undefined;
    when?: string | undefined;
    deadline?: string | undefined;
    list?: string | undefined;
    list_id?: string | undefined;
}>;
export declare const UpdateProjectJSONSchema: z.ZodObject<{
    title: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    when: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["today", "tomorrow", "evening", "anytime", "someday"]>, z.ZodString, z.ZodString]>>;
    deadline: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    area_id: z.ZodOptional<z.ZodString>;
    area: z.ZodOptional<z.ZodString>;
    items: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"todo">;
        title: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
        when: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["today", "tomorrow", "evening", "anytime", "someday"]>, z.ZodString, z.ZodString]>>;
        deadline: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        completed: z.ZodOptional<z.ZodBoolean>;
        canceled: z.ZodOptional<z.ZodBoolean>;
        checklist: z.ZodOptional<z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            completed: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            completed: boolean;
            title: string;
        }, {
            title: string;
            completed?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            completed: boolean;
            title: string;
        }[] | undefined;
    }, {
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            title: string;
            completed?: boolean | undefined;
        }[] | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"heading">;
        title: z.ZodString;
        archived: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        type: "heading";
        title: string;
        archived: boolean;
    }, {
        type: "heading";
        title: string;
        archived?: boolean | undefined;
    }>]>, "many">>;
    completed: z.ZodOptional<z.ZodBoolean>;
    canceled: z.ZodOptional<z.ZodBoolean>;
} & {
    id: z.ZodString;
    operation: z.ZodDefault<z.ZodLiteral<"update">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    operation: "update";
    title: string;
    completed?: boolean | undefined;
    canceled?: boolean | undefined;
    tags?: string[] | undefined;
    items?: ({
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            completed: boolean;
            title: string;
        }[] | undefined;
    } | {
        type: "heading";
        title: string;
        archived: boolean;
    })[] | undefined;
    notes?: string | undefined;
    when?: string | undefined;
    deadline?: string | undefined;
    area?: string | undefined;
    area_id?: string | undefined;
}, {
    id: string;
    title: string;
    completed?: boolean | undefined;
    canceled?: boolean | undefined;
    tags?: string[] | undefined;
    operation?: "update" | undefined;
    items?: ({
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            title: string;
            completed?: boolean | undefined;
        }[] | undefined;
    } | {
        type: "heading";
        title: string;
        archived?: boolean | undefined;
    })[] | undefined;
    notes?: string | undefined;
    when?: string | undefined;
    deadline?: string | undefined;
    area?: string | undefined;
    area_id?: string | undefined;
}>;
export declare const AddItemsToProjectSchema: z.ZodObject<{
    id: z.ZodString;
    items: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"todo">;
        title: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
        when: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["today", "tomorrow", "evening", "anytime", "someday"]>, z.ZodString, z.ZodString]>>;
        deadline: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        completed: z.ZodOptional<z.ZodBoolean>;
        canceled: z.ZodOptional<z.ZodBoolean>;
        checklist: z.ZodOptional<z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            completed: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            completed: boolean;
            title: string;
        }, {
            title: string;
            completed?: boolean | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            completed: boolean;
            title: string;
        }[] | undefined;
    }, {
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            title: string;
            completed?: boolean | undefined;
        }[] | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"heading">;
        title: z.ZodString;
        archived: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        type: "heading";
        title: string;
        archived: boolean;
    }, {
        type: "heading";
        title: string;
        archived?: boolean | undefined;
    }>]>, "many">;
    operation: z.ZodDefault<z.ZodLiteral<"update">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    operation: "update";
    items: ({
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            completed: boolean;
            title: string;
        }[] | undefined;
    } | {
        type: "heading";
        title: string;
        archived: boolean;
    })[];
}, {
    id: string;
    items: ({
        type: "todo";
        title: string;
        completed?: boolean | undefined;
        canceled?: boolean | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
        when?: string | undefined;
        deadline?: string | undefined;
        checklist?: {
            title: string;
            completed?: boolean | undefined;
        }[] | undefined;
    } | {
        type: "heading";
        title: string;
        archived?: boolean | undefined;
    })[];
    operation?: "update" | undefined;
}>;
//# sourceMappingURL=mcp.d.ts.map