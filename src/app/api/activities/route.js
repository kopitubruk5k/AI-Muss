import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── Konfigurasi Notion ───────────────────────────────────────
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID  = process.env.NOTION_ACT_DB_ID;
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

// Helper: ubah page Notion menjadi objek kegiatan
function mapPageToActivity(page) {
    const props = page.properties;
    return {
        id:        page.id,
        title:     props['Nama Kegiatan']?.title[0]?.plain_text || 'Tanpa Judul',
        time:      props.Waktu?.date?.start || page.created_time,
        completed: !!props.Selesai?.date?.start, // true jika tanggal selesai sudah diisi
    };
}

// ─── GET /api/activities ──────────────────────────────────────
// Mengambil semua kegiatan, diurutkan berdasarkan Waktu ascending
export async function GET() {
    try {
        const data = await notionFetch('POST', `/v1/databases/${DATABASE_ID}/query`, {
            sorts: [{ property: 'Waktu', direction: 'ascending' }],
        });

        if (data.object === 'error') {
            return NextResponse.json({ error: data.message }, { status: 500 });
        }

        return NextResponse.json(data.results.map(mapPageToActivity));
    } catch (error) {
        console.error('[GET /api/activities]', error);
        return NextResponse.json({ error: 'Gagal membaca data kegiatan' }, { status: 500 });
    }
}

// ─── POST /api/activities ─────────────────────────────────────
// Body: { title, time }
export async function POST(request) {
    try {
        const { title, time } = await request.json();

        if (!title || !time) {
            return NextResponse.json({ error: 'Field title dan time diperlukan' }, { status: 400 });
        }

        const data = await notionFetch('POST', '/v1/pages', {
            parent: { database_id: DATABASE_ID },
            properties: {
                'Nama Kegiatan': { title: [{ text: { content: title } }] },
                Waktu:           { date: { start: time } },
            },
        });

        if (data.object === 'error') {
            return NextResponse.json({ error: data.message }, { status: 500 });
        }

        return NextResponse.json(mapPageToActivity(data), { status: 201 });
    } catch (error) {
        console.error('[POST /api/activities]', error);
        return NextResponse.json({ error: 'Gagal menyimpan kegiatan' }, { status: 500 });
    }
}

// ─── PUT /api/activities?id=<pageId> ─────────────────────────
// Body: { completed: boolean } — tandai kegiatan selesai/belum
export async function PUT(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Parameter id diperlukan' }, { status: 400 });
        }

        const { completed } = await request.json();

        // Jika selesai → set tanggal; jika belum → hapus tanggal
        const properties = {
            Selesai: completed
                ? { date: { start: new Date().toISOString() } }
                : { date: null },
        };

        const data = await notionFetch('PATCH', `/v1/pages/${id}`, { properties });
        if (data.object === 'error') throw new Error(data.message);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[PUT /api/activities]', error);
        return NextResponse.json({ error: 'Gagal memperbarui kegiatan' }, { status: 500 });
    }
}

// ─── DELETE /api/activities?id=<pageId> ──────────────────────
// Menghapus (archive) satu kegiatan
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Parameter id diperlukan' }, { status: 400 });
        }

        const data = await notionFetch('PATCH', `/v1/pages/${id}`, { archived: true });
        if (data.object === 'error') throw new Error(data.message);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[DELETE /api/activities]', error);
        return NextResponse.json({ error: 'Gagal menghapus kegiatan' }, { status: 500 });
    }
}
