import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

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
        const { tag } = await request.json();
        console.log('Received tag:', tag);

        if (!tag) {
            return NextResponse.json({ error: 'Tag is required' }, { status: 400 });
        }

        const response = await notion.databases.query({
            database_id: databaseId,
            filter: {
                property: "Tag",
                rich_text: {
                    equals: tag
                }
            }
        });
        console.log('Notion query response:', {
            resultsCount: response.results.length,
            firstResult: response.results[0] ? 'exists' : 'null'
        });

        // Get the most recent entry for this tag
        const page = response.results[0] as PageObjectResponse;
        
        if (!page) {
            return NextResponse.json({ error: 'No flowchart found with this tag' }, { status: 404 });
        }

        console.log('Page properties:', Object.keys(page.properties));
        const flowData = page.properties[DB_DATA_PROP];
        console.log('Data JSON property:', {
            type: flowData?.type,
            hasContent: flowData?.type === 'rich_text' ? Boolean(flowData.rich_text[0]) : false
        });

        if (flowData?.type !== 'rich_text' || !flowData.rich_text[0]) {
            return NextResponse.json({ error: 'No flowchart data found' }, { status: 404 });
        }

        const data = JSON.parse(flowData.rich_text[0].plain_text);
        return NextResponse.json(data);

    } catch (error) {
        console.error('Error loading flowchart from Notion:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'Failed to load flowchart from Notion.', details: message }, { status: 500 });
    }
}