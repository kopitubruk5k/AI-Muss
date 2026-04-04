import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── Konfigurasi Notion ───────────────────────────────────────
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID  = process.env.NOTION_TRANS_DB_ID;
const NOTION_HEADERS = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type':  'application/json',
};

// Helper: panggil Notion API
async function notionFetch(method, path, body) {
    const res = await fetch(`https://api.notion.com${path}`, {
        method,
        headers: NOTION_HEADERS,
        body:    body ? JSON.stringify(body) : undefined,
        cache:   'no-store',
    });
    return res.json();
}

// Helper: ubah page Notion menjadi objek transaksi
function mapPageToTransaction(page) {
    const props = page.properties;
    return {
        id:        page.id,
        text:      props.Name?.title[0]?.plain_text || 'Tanpa Nama',
        amount:    props.Jumlah?.number || 0,
        type:      props.Type?.select?.name || 'income',
        source:    props['Sumber Kas']?.select?.name || 'cash',
        createdAt: props.Tanggal?.date?.start || page.created_time,
    };
}

// ─── GET /api/transactions ────────────────────────────────────
// Query-param opsional: ?month=YYYY-MM → filter per bulan
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');

        // Bangun filter jika ada parameter bulan
        const bodyPayload = {
            sorts: [{ property: 'Tanggal', direction: 'descending' }],
        };
        if (month) {
            const [year, mon] = month.split('-').map(Number);
            const startDate = new Date(year, mon - 1, 1).toISOString().split('T')[0];
            const endDate   = new Date(year, mon, 1).toISOString().split('T')[0];
            bodyPayload.filter = {
                and: [
                    { property: 'Tanggal', date: { on_or_after: startDate } },
                    { property: 'Tanggal', date: { before: endDate } },
                ],
            };
        }

        // Pagination — Notion max 100 per query
        let allResults = [];
        let cursor;
        do {
            const data = await notionFetch('POST', `/v1/databases/${DATABASE_ID}/query`, {
                ...bodyPayload,
                start_cursor: cursor,
                page_size: 100,
            });
            if (data.object === 'error') {
                return NextResponse.json({ error: data.message }, { status: 500 });
            }
            allResults = allResults.concat(data.results);
            cursor = data.has_more ? data.next_cursor : undefined;
        } while (cursor);

        return NextResponse.json(allResults.map(mapPageToTransaction));
    } catch (error) {
        console.error('[GET /api/transactions]', error);
        return NextResponse.json({ error: 'Gagal membaca data dari Notion' }, { status: 500 });
    }
}

// ─── POST /api/transactions ───────────────────────────────────
// Body: { text, amount, type, source, date }
export async function POST(request) {
    try {
        const { text, amount, type, source, date } = await request.json();

        if (!text || !amount || !type || !source) {
            return NextResponse.json({ error: 'Field tidak lengkap' }, { status: 400 });
        }

        const transactionDate = date
            ? new Date(date).toISOString()
            : new Date().toISOString();

        const data = await notionFetch('POST', '/v1/pages', {
            parent: { database_id: DATABASE_ID },
            properties: {
                Name:          { title: [{ text: { content: text } }] },
                Jumlah:        { number: Number(amount) },
                Type:          { select: { name: type } },
                'Sumber Kas':  { select: { name: source } },
                Tanggal:       { date: { start: transactionDate } },
            },
        });

        if (data.object === 'error') {
            return NextResponse.json({ error: data.message }, { status: 500 });
        }

        return NextResponse.json(mapPageToTransaction(data), { status: 201 });
    } catch (error) {
        console.error('[POST /api/transactions]', error);
        return NextResponse.json({ error: 'Gagal menyimpan data ke Notion' }, { status: 500 });
    }
}

// ─── DELETE /api/transactions ─────────────────────────────────
// Query-param: ?id=<pageId>  → hapus satu transaksi
//              ?clearAll=true → hapus semua transaksi (archive)
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id       = searchParams.get('id');
        const clearAll = searchParams.get('clearAll');

        if (clearAll === 'true') {
            // Ambil semua page lalu archive satu-satu
            const queryData = await notionFetch('POST', `/v1/databases/${DATABASE_ID}/query`, {});
            await Promise.all(
                queryData.results.map(page =>
                    notionFetch('PATCH', `/v1/pages/${page.id}`, { archived: true })
                )
            );
            return NextResponse.json({ success: true });
        }

        if (id) {
            const data = await notionFetch('PATCH', `/v1/pages/${id}`, { archived: true });
            if (data.object === 'error') throw new Error(data.message);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Parameter id atau clearAll diperlukan' }, { status: 400 });
    } catch (error) {
        console.error('[DELETE /api/transactions]', error);
        return NextResponse.json({ error: 'Gagal menghapus data di Notion' }, { status: 500 });
    }
}
