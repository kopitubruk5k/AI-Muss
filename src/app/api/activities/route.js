import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_ACT_DB_ID;
const headers = {
    "Authorization": `Bearer ${NOTION_TOKEN}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
};

export async function GET() {
    try {
        const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sorts: [{ property: "Waktu", direction: "ascending" }]
            }),
            cache: 'no-store'
        });
        const data = await res.json();

        if (data.object === 'error') {
            return NextResponse.json({ error: data.message }, { status: 500 });
        }

        const activities = data.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                title: props['Nama Kegiatan']?.title[0]?.plain_text || "Tanpa Judul",
                time: props.Waktu?.date?.start || page.created_time,
                completed: !!props.Selesai?.date?.start // true if date exists
            };
        });

        return NextResponse.json(activities);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { title, time } = await request.json();

        if (!title || !time) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const res = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                parent: { database_id: DATABASE_ID },
                properties: {
                    "Nama Kegiatan": { title: [{ text: { content: title } }] },
                    Waktu: { date: { start: time } }
                }
            })
        });

        const page = await res.json();
        if (page.object === 'error') {
            return NextResponse.json({ error: page.message }, { status: 500 });
        }

        const newActivity = {
            id: page.id,
            title,
            time,
            completed: false
        };

        return NextResponse.json(newActivity, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const dataInput = await request.json();

        if (!id) return NextResponse.json({ error: 'Missing id param' }, { status: 400 });

        const properties = {};
        if (dataInput.completed !== undefined) {
            // If completed is true, set Selesai to now. If false, set to null.
            if (dataInput.completed) {
                properties.Selesai = { date: { start: new Date().toISOString() } };
            } else {
                properties.Selesai = { date: null };
            }
        }

        const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ properties })
        });

        const data = await res.json();
        if (data.object === 'error') throw new Error(data.message);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update data' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing id param' }, { status: 400 });

        const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ archived: true })
        });
        const data = await res.json();
        if (data.object === 'error') throw new Error(data.message);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 });
    }
}
