import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

const notion = new Client({ auth: process.env.NOTION_SECRET });
const databaseId = process.env.NOTION_DATABASE_ID;

export async function POST(request: Request) {
    if (!databaseId) {
        return NextResponse.json({ error: 'Notion Database ID not configured.' }, { status: 500 });
    }
    if (!process.env.NOTION_SECRET) {
        return NextResponse.json({ error: 'Notion API Key not configured.' }, { status: 500 });
    }

    try {
        const { uuid } = await request.json();

        if (!uuid || typeof uuid !== 'string') {
            return NextResponse.json({ error: 'Invalid or missing UUID in request body.' }, { status: 400 });
        }

        // 1. Find the page ID based on the UUID property
        const queryResponse = await notion.databases.query({
            database_id: databaseId,
            filter: {
                property: 'UUID', // Make sure your Notion property is named exactly "UUID"
                rich_text: {
                    equals: uuid,
                },
            },
        });

        if (queryResponse.results.length === 0) {
            return NextResponse.json({ error: `Flowchart with UUID "${uuid}" not found.` }, { status: 404 });
        }

        if (queryResponse.results.length > 1) {
            console.warn(`Multiple pages found with UUID "${uuid}". Archiving the first one.`);
        }

        const pageToArchive = queryResponse.results[0] as PageObjectResponse; // Assuming the first result is the one
        const pageId = pageToArchive.id;

        // 2. Archive the page using its ID
        // Archive the page using its ID - no need to store the response
        await notion.pages.update({
            page_id: pageId,
            archived: true,
        });

        // console.log('Page archived:', archiveResponse);

        return NextResponse.json({ message: `Flowchart with UUID "${uuid}" successfully deleted (archived).` });

    } catch (error) {
        console.error('Error deleting flowchart from Notion:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'Failed to delete flowchart from Notion.', details: message }, { status: 500 });
    }
}