import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import type {
    PageObjectResponse,
    PartialPageObjectResponse,
    DatabaseObjectResponse, // Import DatabaseObjectResponse
    PartialDatabaseObjectResponse, // Import PartialDatabaseObjectResponse
    GetPagePropertyResponse,
} from '@notionhq/client/build/src/api-endpoints';
import type { Node, Edge } from 'reactflow';

// Initialize Notion Client
const notion = new Client({ auth: process.env.NOTION_SECRET });
const databaseId = process.env.NOTION_DATABASE_ID;

// --- Database Property Names (Ensure these match your Notion DB) ---
const DB_NODE_ID_PROP = 'Node ID'; // Text or Title (MUST be unique)
const DB_TYPE_PROP = 'Type';       // Select or Text
const DB_LABEL_PROP = 'Label';     // Text or Title (if Node ID is not Title)
const DB_POS_X_PROP = 'Position X'; // Number
const DB_POS_Y_PROP = 'Position Y'; // Number
const DB_DATA_PROP = 'Data JSON';  // Text (stores stringified data)
const DB_OUTGOING_PROP = 'Outgoing Connections'; // Text
const DB_INCOMING_PROP = 'Incoming Connections'; // Text
// Optional: Add specific data props like 'Node Text', 'Image URL', etc.
const DB_NODE_TEXT_PROP = 'Node Text'; // Example for TextNode

// Type guard to check for full PageObjectResponse
const isPageObjectResponse = (
    res: PageObjectResponse | PartialPageObjectResponse | PartialDatabaseObjectResponse | DatabaseObjectResponse
): res is PageObjectResponse => {
    return (res as PageObjectResponse).properties !== undefined;
};

// Helper to safely get property values from Notion page objects
const getPropertyValue = (page: PageObjectResponse, propName: string): any => {
    const property = page.properties[propName];
    if (!property) return null;

    switch (property.type) {
        case 'title':
            return property.title[0]?.plain_text || null;
        case 'rich_text':
            return property.rich_text[0]?.plain_text || null;
        case 'number':
            return property.number;
        case 'select':
            return property.select?.name || null;
        // Add other types as needed (date, relation, etc.)
        default:
            return null;
    }
};

// Helper to format node data for Notion page properties (Create/Update)
// Recalculates connections based on the *current* edges array
const formatNodePropertiesForUpdate = (node: Node, edges: Edge[]) => {
    const outgoing = edges.filter(edge => edge.source === node.id).map(edge => edge.target);
    const incoming = edges.filter(edge => edge.target === node.id).map(edge => edge.source);

    const properties: any = {
        // Node ID is usually set only on creation or used for matching, not updated.
        // If DB_NODE_ID_PROP is Title, it needs special handling on update if it changes.
        // Assuming DB_NODE_ID_PROP is NOT the Title property for easier updates.
        // If it IS the Title, update the title property instead.
        // [DB_NODE_ID_PROP]: { rich_text: [{ type: 'text', text: { content: node.id } }] },

        // Example assuming DB_LABEL_PROP is the Title property:
        [DB_LABEL_PROP]: {
             title: [{ type: 'text', text: { content: node.data?.label || node.id } }], // Use label or ID as title
        },
        [DB_TYPE_PROP]: {
            select: { name: node.type || 'default' },
        },
        [DB_POS_X_PROP]: {
            number: node.position.x,
        },
        [DB_POS_Y_PROP]: {
            number: node.position.y,
        },
        [DB_DATA_PROP]: { // Store potentially large data
            rich_text: [{ type: 'text', text: { content: JSON.stringify(node.data || {}) } }],
        },
        [DB_OUTGOING_PROP]: {
             rich_text: [{ type: 'text', text: { content: outgoing.join(', ') } }],
        },
        [DB_INCOMING_PROP]: {
             rich_text: [{ type: 'text', text: { content: incoming.join(', ') } }],
        },
    };

     // Add/Update specific properties based on node type
    if (node.type === 'text') {
        properties[DB_NODE_TEXT_PROP] = { // Assuming 'Node Text' Rich Text column
             rich_text: [{ type: 'text', text: { content: node.data?.text || '' } }],
        }
    }
    // Add similar updates for image, attachment, social URLs if columns exist

    return properties;
};

// Helper to compare relevant properties for changes
const havePropertiesChanged = (node: Node, page: PageObjectResponse, edges: Edge[]): boolean => {
    const currentPosX = getPropertyValue(page, DB_POS_X_PROP);
    const currentPosY = getPropertyValue(page, DB_POS_Y_PROP);
    const currentData = getPropertyValue(page, DB_DATA_PROP);
    const currentLabel = getPropertyValue(page, DB_LABEL_PROP); // Assuming Label is Title
    const currentType = getPropertyValue(page, DB_TYPE_PROP);

    // Basic position check
    if (node.position.x !== currentPosX || node.position.y !== currentPosY) return true;

    // Basic data check (simple string comparison of JSON)
    if (JSON.stringify(node.data || {}) !== currentData) return true;

    // Check label/title
    if ((node.data?.label || node.id) !== currentLabel) return true;

    // Check type
    if ((node.type || 'default') !== currentType) return true;

    // Check connections (recalculate based on current edges)
    const outgoing = edges.filter(edge => edge.source === node.id).map(edge => edge.target).join(', ');
    const incoming = edges.filter(edge => edge.target === node.id).map(edge => edge.source).join(', ');
    if (outgoing !== getPropertyValue(page, DB_OUTGOING_PROP)) return true;
    if (incoming !== getPropertyValue(page, DB_INCOMING_PROP)) return true;

    // Add checks for specific data properties (e.g., text content)
    if (node.type === 'text' && (node.data?.text || '') !== getPropertyValue(page, DB_NODE_TEXT_PROP)) return true;


    return false; // No changes detected
};


export async function POST(request: Request) {
    if (!databaseId) {
        return NextResponse.json({ error: 'Notion Database ID not configured.' }, { status: 500 });
    }
    if (!process.env.NOTION_SECRET) {
         return NextResponse.json({ error: 'Notion API Key not configured.' }, { status: 500 });
    }

    let nodesToCreate: Node[] = [];
    let pagesToUpdate: { pageId: string; properties: any }[] = [];
    let pagesToDelete: string[] = []; // Store Notion Page IDs to delete

    try {
        const { nodes: frontendNodes, edges } = await request.json() as { nodes: Node[], edges: Edge[] };

        if (!frontendNodes || !edges) {
            return NextResponse.json({ error: 'Missing nodes or edges in request body.' }, { status: 400 });
        }

        console.log(`Syncing ${frontendNodes.length} nodes and ${edges.length} edges with Notion...`);

        // 1. Fetch all existing pages from Notion DB
        console.log("Fetching existing pages from Notion...");
        const notionPagesMap = new Map<string, PageObjectResponse>(); // Map<NodeID, NotionPage>
        let nextCursor: string | undefined = undefined;
        do {
            const response = await notion.databases.query({
                database_id: databaseId,
                start_cursor: nextCursor,
                // Add filter if Node ID property is not Title, otherwise query all
                // filter: { property: DB_NODE_ID_PROP, rich_text: { is_not_empty: true } }
            });
            for (const page of response.results) {
                // Use the type guard to ensure we have a full page object
                if (isPageObjectResponse(page)) {
                    const nodeID = getPropertyValue(page, DB_NODE_ID_PROP); // Get Node ID from property
                    if (nodeID) {
                        notionPagesMap.set(nodeID, page); // Now 'page' is correctly typed
                    } else {
                        // It's a full page, but missing the required Node ID property
                        console.warn(`Page ${page.id} is missing the Node ID property ('${DB_NODE_ID_PROP}'), skipping.`);
                    }
                } else {
                     // Log if we encounter other object types in the results (shouldn't happen with DB query)
                     console.warn(`Skipping non-page object in database query results: ${page.id}`);
                }
            }
            nextCursor = response.next_cursor ?? undefined;
        } while (nextCursor);
        console.log(`Found ${notionPagesMap.size} existing pages with Node IDs.`);

        // 2. Compare and determine operations
        const frontendNodeIds = new Set(frontendNodes.map(n => n.id));

        // Find nodes to create and update
        for (const node of frontendNodes) {
            const existingPage = notionPagesMap.get(node.id);
            if (existingPage) {
                // Check if update is needed
                if (havePropertiesChanged(node, existingPage, edges)) {
                    console.log(`Node ${node.id} needs update.`);
                    pagesToUpdate.push({
                        pageId: existingPage.id,
                        properties: formatNodePropertiesForUpdate(node, edges),
                    });
                } else {
                    // console.log(`Node ${node.id} has no changes.`);
                }
            } else {
                // Node exists in frontend but not in Notion -> Create
                console.log(`Node ${node.id} needs creation.`);
                nodesToCreate.push(node);
            }
        }

        // Find pages to delete
        for (const [nodeId, page] of notionPagesMap.entries()) {
            if (!frontendNodeIds.has(nodeId)) {
                // Node exists in Notion but not in frontend -> Delete
                console.log(`Node ${nodeId} (Page ${page.id}) needs deletion.`);
                pagesToDelete.push(page.id);
            }
        }

        // 3. Execute Batch Operations
        const promises: Promise<any>[] = [];

        // Deletions
        if (pagesToDelete.length > 0) {
            console.log(`Deleting ${pagesToDelete.length} pages...`);
            pagesToDelete.forEach(pageId => {
                promises.push(notion.pages.update({ page_id: pageId, archived: true }));
            });
        }

        // Creations
        if (nodesToCreate.length > 0) {
            console.log(`Creating ${nodesToCreate.length} pages...`);
            nodesToCreate.forEach(node => {
                // Ensure the Node ID property is included for creation if it's not the Title
                const properties = formatNodePropertiesForUpdate(node, edges);
                // This check allows flexibility if the user configures Node ID as the Title property.
                // With current constants ('Node ID' !== 'Label'), this is always true, hence the TS warning is expected but the check is intentional.
                if (DB_NODE_ID_PROP !== DB_LABEL_PROP) {
                     properties[DB_NODE_ID_PROP] = { rich_text: [{ type: 'text', text: { content: node.id } }] };
                }
                promises.push(notion.pages.create({
                    parent: { database_id: databaseId },
                    properties: properties,
                }));
            });
        }

        // Updates
        if (pagesToUpdate.length > 0) {
            console.log(`Updating ${pagesToUpdate.length} pages...`);
            pagesToUpdate.forEach(({ pageId, properties }) => {
                promises.push(notion.pages.update({
                    page_id: pageId,
                    properties: properties,
                }));
            });
        }

        // Execute all promises
        if (promises.length > 0) {
            const results = await Promise.allSettled(promises);
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    // Log detailed error for the specific failed operation
                    console.error(`Notion API operation failed at index ${index}:`, result.reason);
                    // You might want to collect these errors and report them back
                }
            });
            // Check if any failed
             const failedCount = results.filter(r => r.status === 'rejected').length;
             if (failedCount > 0) {
                 console.error(`${failedCount} Notion API operations failed.`);
                 // Consider returning a partial success or error message
             }
        } else {
            console.log("No changes detected, nothing to sync.");
        }


        return NextResponse.json({
            success: true,
            message: `Sync complete. Created: ${nodesToCreate.length}, Updated: ${pagesToUpdate.length}, Deleted: ${pagesToDelete.length}.`,
        });

    } catch (error: any) {
        console.error('Error syncing with Notion:', error);
        if (error.code === 'object_not_found') {
             return NextResponse.json({ error: 'Notion Database not found or API key lacks permissions.' }, { status: 404 });
        }
         if (error.code === 'validation_error') {
             return NextResponse.json({ error: 'Notion API validation error. Check property names/types.', details: error.message }, { status: 400 });
         }
        return NextResponse.json({ error: 'Failed to sync data with Notion.', details: error.message || error }, { status: 500 });
    }
}