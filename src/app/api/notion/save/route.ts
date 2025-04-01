import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import type { Node, Edge } from 'reactflow';

const notion = new Client({ auth: process.env.NOTION_SECRET });
const databaseId = process.env.NOTION_DATABASE_ID;

// Database property names
const DB_DATA_PROP = 'Data JSON';  // Text (stores stringified data)

export async function POST(request: Request) {
    if (!databaseId) {
        return NextResponse.json({ error: 'Notion Database ID not configured.' }, { status: 500 });
    }
    if (!process.env.NOTION_SECRET) {
        return NextResponse.json({ error: 'Notion API Key not configured.' }, { status: 500 });
    }

    try {
        const { nodes, edges, tag, uuid } = await request.json() as {
            nodes: Node[],
            edges: Edge[],
            tag: string,
            uuid: string
        };

        if (!nodes || !edges || !tag) {
            return NextResponse.json({ error: 'Missing required data in request body.' }, { status: 400 });
        }

        console.log(`Saving flowchart with tag ${tag}...`);

        // 1. Query existing pages with this tag
        const response = await notion.databases.query({
            database_id: databaseId,
            filter: {
                property: "UUID",
                rich_text: {
                    equals: uuid
                }
            }
        });

        // 2. Archive existing pages with this tag
        for (const page of response.results) {
            await notion.pages.update({
                page_id: page.id,
                archived: true
            });
        }

        // 3. Create new page with the flowchart data
        console.log('Creating new page with data:', {
            tag,
            nodesCount: nodes.length,
            edgesCount: edges.length
        });

        const flowchartData = JSON.stringify({ nodes, edges });
        console.log('Flowchart data length:', flowchartData.length);

        // Helper function to chunk string
        const chunkString = (str: string, size: number): string[] => {
            const numChunks = Math.ceil(str.length / size);
            const chunks = new Array(numChunks);
            for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
                chunks[i] = str.substring(o, o + size);
            }
            return chunks;
        };

        // Chunk the data (Notion limit is 2000 chars per rich_text object)
        const dataChunks = chunkString(flowchartData, 1999); // Use 1999 for safety margin
        const richTextData = dataChunks.map(chunk => ({
            text: { content: chunk }
        }));

        console.log(`Split data into ${dataChunks.length} chunks.`);

        const result = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                Tag: {
                    rich_text: [{
                        text: { content: tag }
                    }]
                },
                UUID: {
                    rich_text: [{
                        text: { content: uuid }
                    }]
                },
                [DB_DATA_PROP]: {
                    rich_text: richTextData // Use the chunked rich text array
                },
                CreateDate: {
                    date: {
                        start: new Date().toISOString()
                    }
                },
                UpdateDate: {
                    date: {
                        start: new Date().toISOString()
                    }
                }
            }
        });

        console.log('Created Notion page:', {
            pageId: result.id
        });

        return NextResponse.json({
            success: true,
            message: `Successfully saved flowchart with tag: ${tag}`
        });

    } catch (error) {
        console.error('Error saving to Notion:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'Failed to save data to Notion.', details: message }, { status: 500 });
    }
}