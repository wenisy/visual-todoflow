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
                    property: "Tag",
                    direction: "descending"
                }
            ]
        });

        const tags = response.results
            .filter((page): page is PageObjectResponse => 'properties' in page)
            .map(page => {
                const tagProp = page.properties["Tag"];
                if (tagProp?.type === 'rich_text' && tagProp.rich_text[0]) {
                    return tagProp.rich_text[0].plain_text;
                }
                return null;
            })
            .filter((tag): tag is string => tag !== null)
            .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates

        return NextResponse.json({ tags });

    } catch (error) {
        console.error('Error fetching tags from Notion:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'Failed to fetch tags from Notion.', details: message }, { status: 500 });
    }
}