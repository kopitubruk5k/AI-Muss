import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_TRANS_DB_ID;
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
                sorts: [{ property: "Tanggal", direction: "descending" }]
            }),
            cache: 'no-store'
        });
        const data = await res.json();

        if (data.object === 'error') {
            return NextResponse.json({ error: data.message }, { status: 500 });
        }

        const transactions = data.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                text: props.Name?.title[0]?.plain_text || "Tanpa Nama",
                amount: props.Jumlah?.number || 0,
                type: props.Type?.select?.name || "income",
                source: props['Sumber Kas']?.select?.name || "cash",
                createdAt: props.Tanggal?.date?.start || page.created_time
            };
        });

        return NextResponse.json(transactions);
    } catch (error) {
        console.error("GET Error:", error);
        return NextResponse.json({ error: 'Failed to read data from Notion' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { text, amount, type, source, date } = await request.json();

        if (!text || !amount || !type || !source) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const transactionDate = date ? new Date(date).toISOString() : new Date().toISOString();

        const res = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                parent: { database_id: DATABASE_ID },
                properties: {
                    Name: { title: [{ text: { content: text } }] },
                    Jumlah: { number: Number(amount) },
                    Type: { select: { name: type } },
                    "Sumber Kas": { select: { name: source } },
                    Tanggal: { date: { start: transactionDate } }
                }
            })
        });

        const page = await res.json();
        if (page.object === 'error') {
            return NextResponse.json({ error: page.message }, { status: 500 });
        }

        const newTransaction = {
            id: page.id,
            text,
            amount: Number(amount),
            type,
            source,
            createdAt: page.properties.Tanggal?.date?.start || page.created_time
        };

        return NextResponse.json(newTransaction, { status: 201 });
    } catch (error) {
        console.error("POST Error:", error);
        return NextResponse.json({ error: 'Failed to save data to Notion' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const clearAll = searchParams.get('clearAll');

        if (clearAll === 'true') {
            const queryRes = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            });
            const queryData = await queryRes.json();

            await Promise.all(queryData.results.map(page =>
                fetch(`https://api.notion.com/v1/pages/${page.id}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ archived: true })
                })
            ));

            return NextResponse.json({ success: true });
        } else if (id) {
            const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ archived: true })
            });
            const data = await res.json();
            if (data.object === 'error') throw new Error(data.message);
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Missing id or clearAll param' }, { status: 400 });
        }
    } catch (error) {
        console.error("DELETE Error:", error);
        return NextResponse.json({ error: 'Failed to delete data in Notion' }, { status: 500 });
    }
}
