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
        const { uuid } = await request.json();
        console.log('Received uuid:', uuid);

        if (!uuid) {
            return NextResponse.json({ error: 'UUID is required' }, { status: 400 });
        }

        const response = await notion.databases.query({
            database_id: databaseId,
            filter: {
                property: "UUID",
                rich_text: {
                    equals: uuid
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
            return NextResponse.json({ error: 'No flowchart found with this UUID' }, { status: 404 });
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

        // Get tag and dates from properties
        const tagProp = page.properties['Tag'] as { type: string; rich_text: Array<{ plain_text: string }> };
        const createDateProp = page.properties['CreateDate'] as { type: string; date: { start: string } };
        const updateDateProp = page.properties['UpdateDate'] as { type: string; date: { start: string } };

        // Combine all rich_text parts to reconstruct the full JSON string
        const fullJsonString = flowData.rich_text.map(rt => rt.plain_text).join('');
        const data = JSON.parse(fullJsonString);
        return NextResponse.json({
            ...data,
            tag: tagProp.rich_text[0]?.plain_text,
            uuid,
            createDate: createDateProp.date?.start,
            updateDate: updateDateProp.date?.start
        });

    } catch (error) {
        console.error('Error loading flowchart from Notion:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'Failed to load flowchart from Notion.', details: message }, { status: 500 });
    }
}