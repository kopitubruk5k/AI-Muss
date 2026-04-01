import { NextResponse } from 'next/server';

// ============================================================
// Vercel Cron Job: /api/cron/monthly-report
// Jadwal  : Setiap tanggal 1 jam 00:05 WIB (17:05 UTC)
// Fungsi  : Membuat halaman laporan bulan lalu di Notion
//           secara otomatis, jika belum ada.
// ============================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds

const NOTION_TOKEN    = process.env.NOTION_TOKEN;
const DATABASE_ID     = process.env.NOTION_TRANS_DB_ID;
const PARENT_PAGE_ID  = process.env.NOTION_REPORT_PAGE_ID; // ID halaman Laporan Keuangan Bulanan
const CRON_SECRET     = process.env.CRON_SECRET;

const NOTION_HEADERS = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
};

const MONTH_NAMES = [
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
];

// ─── Helpers ─────────────────────────────────────────────────

function formatIDR(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(amount);
}

function formatDatetime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
    });
}

// ─── Notion API call ─────────────────────────────────────────

async function notionFetch(method, path, body) {
    const res = await fetch(`https://api.notion.com${path}`, {
        method,
        headers: NOTION_HEADERS,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store'
    });
    const data = await res.json();
    if (data.object === 'error') throw new Error(`Notion API: ${data.message}`);
    return data;
}

// ─── Fetch transactions for a specific month ─────────────────

async function fetchTransactionsForMonth(year, month) {
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate   = new Date(year, month, 1).toISOString().split('T')[0];

    let all = [], cursor;
    do {
        const body = {
            filter: {
                and: [
                    { property: 'Tanggal', date: { on_or_after: startDate } },
                    { property: 'Tanggal', date: { before: endDate } }
                ]
            },
            sorts: [{ property: 'Tanggal', direction: 'ascending' }],
            page_size: 100,
            ...(cursor && { start_cursor: cursor })
        };
        const data = await notionFetch('POST', `/v1/databases/${DATABASE_ID}/query`, body);
        all = all.concat(data.results);
        cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    return all.map(p => ({
        id:     p.id,
        name:   p.properties.Name?.title[0]?.plain_text || 'Tanpa Nama',
        amount: p.properties.Jumlah?.number || 0,
        type:   p.properties.Type?.select?.name || 'expense',
        source: p.properties['Sumber Kas']?.select?.name || '-',
        date:   p.properties.Tanggal?.date?.start || p.created_time
    }));
}

// ─── Check if monthly page already exists ────────────────────

async function monthlyPageExists(monthLabel) {
    const data = await notionFetch('GET', `/v1/blocks/${PARENT_PAGE_ID}/children?page_size=100`);
    const pages = data.results.filter(b => b.type === 'child_page');
    return pages.some(p => p.child_page.title.includes(monthLabel));
}

// ─── Build Notion blocks ──────────────────────────────────────

function buildTableRows(transactions) {
    const header = {
        type: 'table_row',
        table_row: {
            cells: [
                [{ type:'text', text:{content:'Nama Transaksi'}, annotations:{bold:true} }],
                [{ type:'text', text:{content:'Jumlah'},          annotations:{bold:true} }],
                [{ type:'text', text:{content:'Tipe'},            annotations:{bold:true} }],
                [{ type:'text', text:{content:'Sumber Kas'},      annotations:{bold:true} }],
                [{ type:'text', text:{content:'Tanggal & Waktu'}, annotations:{bold:true} }]
            ]
        }
    };
    const rows = transactions.map(t => ({
        type: 'table_row',
        table_row: {
            cells: [
                [{ type:'text', text:{content: t.name} }],
                [{ type:'text', text:{content: formatIDR(t.amount)},
                   annotations:{color: t.type==='income'?'green':'red'} }],
                [{ type:'text', text:{content: t.type==='income'?'Pemasukan':'Pengeluaran'} }],
                [{ type:'text', text:{content: t.source || '-'} }],
                [{ type:'text', text:{content: formatDatetime(t.date)} }]
            ]
        }
    }));
    return [header, ...rows];
}

// ─── Create Monthly Notion Page ───────────────────────────────

async function createMonthlyPage(monthLabel, transactions) {
    const income  = transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount, 0);
    const expense = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount, 0);
    const balance = income - expense;
    const balUp   = balance >= 0;
    const emoji   = balUp ? '📈' : '📉';

    // Create page with summary
    const page = await notionFetch('POST', '/v1/pages', {
        parent: { page_id: PARENT_PAGE_ID },
        icon:   { type: 'emoji', emoji },
        properties: {
            title: [{ text: { content: `${emoji} Laporan ${monthLabel}` } }]
        },
        children: [
            { type:'heading_2', heading_2:{ rich_text:[{text:{content:'📊 Ringkasan Keuangan'}}] } },
            {
                type: 'callout',
                callout: {
                    rich_text: [
                        { text:{ content:`Total Pemasukan  : ${formatIDR(income)}\n` } },
                        { text:{ content:`Total Pengeluaran: ${formatIDR(expense)}\n` } },
                        { text:{ content:`Saldo Bulan Ini  : ${formatIDR(balance)}` }, annotations:{bold:true} }
                    ],
                    icon:  { type:'emoji', emoji:'💰' },
                    color: balUp ? 'green_background' : 'red_background'
                }
            },
            {
                type: 'column_list',
                column_list: {
                    children: [
                        { type:'column', column:{ children:[{ type:'callout', callout:{
                            rich_text:[{text:{content:'Pemasukan\n'},annotations:{bold:true}},{text:{content:formatIDR(income)},annotations:{color:'green'}}],
                            icon:{type:'emoji',emoji:'📥'}, color:'green_background'
                        }}]}},
                        { type:'column', column:{ children:[{ type:'callout', callout:{
                            rich_text:[{text:{content:'Pengeluaran\n'},annotations:{bold:true}},{text:{content:formatIDR(expense)},annotations:{color:'red'}}],
                            icon:{type:'emoji',emoji:'📤'}, color:'red_background'
                        }}]}},
                        { type:'column', column:{ children:[{ type:'callout', callout:{
                            rich_text:[{text:{content:'Saldo Akhir\n'},annotations:{bold:true}},{text:{content:formatIDR(balance)},annotations:{color:balUp?'green':'red'}}],
                            icon:{type:'emoji',emoji:balUp?'🏦':'💸'}, color:balUp?'green_background':'red_background'
                        }}]}}
                    ]
                }
            },
            { type:'divider', divider:{} },
            { type:'heading_2', heading_2:{ rich_text:[{text:{content:`📋 Daftar Transaksi (${transactions.length} entri)`}}] } }
        ]
    });

    // Append table
    const tableRows = buildTableRows(transactions);
    await notionFetch('PATCH', `/v1/blocks/${page.id}/children`, {
        children: [{
            type: 'table',
            table: { table_width:5, has_column_header:true, has_row_header:false, children: tableRows.slice(0, 100) }
        }]
    });

    // If more than 99 data rows, append in chunks
    if (tableRows.length > 100) {
        // Get table block ID
        const tableData = await notionFetch('GET', `/v1/blocks/${page.id}/children?page_size=10`);
        const tableBlock = tableData.results.find(b => b.type === 'table');
        if (tableBlock) {
            for (let i = 99; i < tableRows.length; i += 98) {
                await notionFetch('PATCH', `/v1/blocks/${tableBlock.id}/children`, {
                    children: tableRows.slice(i, i + 98)
                });
            }
        }
    }

    return page;
}

// ─── GET handler (dipanggil oleh Vercel Cron) ─────────────────

export async function GET(request) {
    // Validasi secret key agar tidak bisa dipanggil sembarang
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Cek environment variables
    if (!NOTION_TOKEN || !DATABASE_ID || !PARENT_PAGE_ID) {
        return NextResponse.json({
            error: 'Missing env: NOTION_TOKEN, NOTION_TRANS_DB_ID, atau NOTION_REPORT_PAGE_ID'
        }, { status: 500 });
    }

    try {
        // Tentukan bulan lalu
        const now       = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const year      = lastMonth.getFullYear();
        const month     = lastMonth.getMonth() + 1; // 1-12
        const monthLabel = `${MONTH_NAMES[lastMonth.getMonth()]} ${year}`;

        console.log(`[Cron] Mengecek laporan untuk: ${monthLabel}`);

        // Cek apakah halaman sudah ada
        const exists = await monthlyPageExists(monthLabel);
        if (exists) {
            console.log(`[Cron] Halaman "${monthLabel}" sudah ada, skip.`);
            return NextResponse.json({
                status: 'skipped',
                message: `Halaman "${monthLabel}" sudah ada.`,
                month: monthLabel
            });
        }

        // Ambil transaksi bulan lalu
        const transactions = await fetchTransactionsForMonth(year, month);
        console.log(`[Cron] Ditemukan ${transactions.length} transaksi untuk ${monthLabel}`);

        if (transactions.length === 0) {
            return NextResponse.json({
                status: 'skipped',
                message: `Tidak ada transaksi di ${monthLabel}.`,
                month: monthLabel
            });
        }

        // Buat halaman di Notion
        const page = await createMonthlyPage(monthLabel, transactions);

        console.log(`[Cron] Halaman "${monthLabel}" berhasil dibuat: ${page.url}`);

        return NextResponse.json({
            status: 'created',
            message: `Laporan ${monthLabel} berhasil dibuat!`,
            month: monthLabel,
            transactions: transactions.length,
            url: page.url
        });

    } catch (error) {
        console.error('[Cron] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
