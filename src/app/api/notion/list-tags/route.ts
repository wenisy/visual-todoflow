import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

const notion = new Client({ auth: process.env.NOTION_SECRET });
const databaseId = process.env.NOTION_DATABASE_ID;

export async function GET() {
    if (!databaseId) {
        return NextResponse.json({ error: 'Notion Database ID not configured.' }, { status: 500 });
    }
    if (!process.env.NOTION_SECRET) {
        return NextResponse.json({ error: 'Notion API Key not configured.' }, { status: 500 });
    }

    try {
        const response = await notion.databases.query({
            database_id: databaseId,
            sorts: [
                {
                    // Sort by Notion's internal created time property
                    timestamp: "created_time",
                    direction: "descending"
                }
            ]
        });

        const flowcharts = response.results
            .filter((page): page is PageObjectResponse => 'properties' in page)
            .map(page => {
                const tagProp = page.properties["Tag"];
                const uuidProp = page.properties["UUID"];
                if (tagProp?.type === 'rich_text' &&
                    uuidProp?.type === 'rich_text' &&
                    tagProp.rich_text[0] &&
                    uuidProp.rich_text[0]) {
                    return {
                        tag: tagProp.rich_text[0].plain_text,
                        uuid: uuidProp.rich_text[0].plain_text,
                        created_time: page.created_time // Include created_time
                    };
                }
                return null;
            })
            .filter((item): item is { tag: string; uuid: string; created_time: string } => item !== null) // Update type guard
            // Remove duplicates based on UUID
            .filter((item, index, self) =>
                index === self.findIndex((t) => t.uuid === item.uuid)
            );

        return NextResponse.json({ flowcharts });

    } catch (error) {
        console.error('Error fetching tags from Notion:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'Failed to fetch tags from Notion.', details: message }, { status: 500 });
    }
}