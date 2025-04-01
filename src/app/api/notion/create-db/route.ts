import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { parentPageId, dbTitle, properties } = await request.json();
    const notionSecret = process.env.NOTION_SECRET;

    if (!notionSecret) {
      return NextResponse.json({ error: 'Notion secret is not configured in environment variables (NOTION_SECRET)' }, { status: 500 });
    }
    if (!parentPageId || !dbTitle || !properties) {
      return NextResponse.json({ error: 'Missing required parameters: parentPageId, dbTitle, properties' }, { status: 400 });
    }

    const notion = new Client({ auth: notionSecret });

    // Define the database schema based on the 'properties' input
    // Example: { "Name": { "title": {} }, "Status": { "select": { "options": [{ "name": "To Do" }, { "name": "In Progress" }, { "name": "Done" }] } } }
    const dbProperties = properties;

    const response = await notion.databases.create({
      parent: {
        type: 'page_id',
        page_id: parentPageId,
      },
      title: [
        {
          type: 'text',
          text: {
            content: dbTitle,
          },
        },
      ],
      properties: dbProperties,
      // Add is_inline: true if you want an inline database
    });

    console.log('Successfully created Notion database:', response);
    return NextResponse.json({ success: true, databaseId: response.id });

  } catch (error: any) {
    console.error('Error creating Notion database:', error.body || error.message);
    return NextResponse.json({ error: 'Failed to create Notion database', details: error.body || error.message }, { status: 500 });
  }
}