// ============================================================
// Script: create-monthly-pages.js
// Fungsi: Membuat halaman bulanan di Notion berisi ringkasan
//         dan tabel transaksi per bulan dari Database Transaksi
// Jalankan: node create-monthly-pages.js
// ============================================================

const fs   = require('fs');
const path = require('path');
const https= require('https');

// ─── Load .env.local ─────────────────────────────────────────
function loadEnv(filePath) {
    try {
        fs.readFileSync(filePath, 'utf-8').split('\n').forEach(line => {
            const t = line.trim();
            if (!t || t.startsWith('#')) return;
            const i = t.indexOf('=');
            if (i < 0) return;
            const k = t.slice(0, i).trim();
            const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[k]) process.env[k] = v;
        });
    } catch (e) { console.error('Cannot read .env.local:', e.message); }
}
loadEnv(path.join(__dirname, '.env.local'));

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID  = process.env.NOTION_TRANS_DB_ID;
// Page sudah dibuat manual: https://www.notion.so/Laporan-Keuangan-Bulanan-335adbe620ea80ce8647f73e6cfb0391
const PARENT_PAGE_ID = '335adbe620ea80ce8647f73e6cfb0391';

if (!NOTION_TOKEN || !DATABASE_ID) {
    console.error('ERROR: NOTION_TOKEN atau NOTION_TRANS_DB_ID tidak ditemukan');
    process.exit(1);
}

// ─── HTTPS helper (pakai https module, bukan fetch) ──────────
function notionRequest(method, apiPath, body) {
    return new Promise((resolve, reject) => {
        const bodyStr = body ? JSON.stringify(body) : '';
        const options = {
            hostname: 'api.notion.com',
            path: apiPath,
            method,
            headers: {
                'Authorization': 'Bearer ' + NOTION_TOKEN,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr)
            }
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.object === 'error') reject(new Error(parsed.message));
                    else resolve(parsed);
                } catch (e) { reject(new Error('JSON parse error: ' + data.slice(0, 100))); }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

// ─── Helpers ─────────────────────────────────────────────────
function formatIDR(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(amount);
}

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni',
                     'Juli','Agustus','September','Oktober','November','Desember'];

function getMonthLabel(dateStr) {
    const d = new Date(dateStr);
    return MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
}

function getMonthSortKey(dateStr) {
    const d = new Date(dateStr);
    return d.getFullYear() * 100 + d.getMonth();
}

function formatDatetime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Fetch All Transactions ───────────────────────────────────
async function fetchAllTransactions() {
    process.stdout.write('Mengambil semua transaksi dari Notion...\n');
    let all = [], cursor;
    do {
        const body = { sorts: [{ property: 'Tanggal', direction: 'ascending' }], page_size: 100 };
        if (cursor) body.start_cursor = cursor;
        const data = await notionRequest('POST', '/v1/databases/' + DATABASE_ID + '/query', body);
        all = all.concat(data.results);
        cursor = data.has_more ? data.next_cursor : undefined;
        process.stdout.write('  Diambil: ' + all.length + ' transaksi\r');
    } while (cursor);
    process.stdout.write('\nTotal transaksi: ' + all.length + '\n');
    return all;
}

// ─── Append Blocks ────────────────────────────────────────────
async function appendBlocks(blockId, children) {
    return notionRequest('PATCH', '/v1/blocks/' + blockId + '/children', { children });
}

// ─── Build Table Rows ─────────────────────────────────────────
function buildTableRows(transactions) {
    const header = {
        type: 'table_row',
        table_row: {
            cells: [
                [{ type:'text', text:{content:'Nama Transaksi'}, annotations:{bold:true} }],
                [{ type:'text', text:{content:'Jumlah'},         annotations:{bold:true} }],
                [{ type:'text', text:{content:'Tipe'},           annotations:{bold:true} }],
                [{ type:'text', text:{content:'Sumber Kas'},     annotations:{bold:true} }],
                [{ type:'text', text:{content:'Tanggal & Waktu'},annotations:{bold:true} }]
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
                [{ type:'text', text:{content: t.source||'-'} }],
                [{ type:'text', text:{content: formatDatetime(t.date)} }]
            ]
        }
    }));

    return [header, ...rows];
}

// ─── Create Monthly Page ──────────────────────────────────────
async function createMonthlyPage(monthLabel, transactions) {
    const income  = transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount, 0);
    const expense = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount, 0);
    const balance = income - expense;
    const balUp   = balance >= 0;
    const emoji   = balUp ? '📈' : '📉';

    // 1. Create the page with summary content
    const page = await notionRequest('POST', '/v1/pages', {
        parent: { page_id: PARENT_PAGE_ID },
        icon:   { type: 'emoji', emoji },
        properties: {
            title: [{ text: { content: emoji + ' Laporan ' + monthLabel } }]
        },
        children: [
            // Heading
            { type:'heading_2', heading_2:{ rich_text:[{text:{content:'Ringkasan Keuangan'}}] } },

            // Summary callout
            {
                type: 'callout',
                callout: {
                    rich_text: [
                        { text:{ content:'Total Pemasukan  : '+formatIDR(income)+'\n' } },
                        { text:{ content:'Total Pengeluaran: '+formatIDR(expense)+'\n' } },
                        { text:{ content:'Saldo Bulan Ini  : '+formatIDR(balance) }, annotations:{bold:true} }
                    ],
                    icon:  { type:'emoji', emoji:'💰' },
                    color: balUp ? 'green_background' : 'red_background'
                }
            },

            // 3 column stats
            {
                type: 'column_list',
                column_list: {
                    children: [
                        {
                            type:'column', column:{ children:[{
                                type:'callout', callout:{
                                    rich_text:[
                                        {text:{content:'Pemasukan\n'}, annotations:{bold:true}},
                                        {text:{content:formatIDR(income)}, annotations:{color:'green'}}
                                    ],
                                    icon:{type:'emoji',emoji:'📥'}, color:'green_background'
                                }
                            }]}
                        },
                        {
                            type:'column', column:{ children:[{
                                type:'callout', callout:{
                                    rich_text:[
                                        {text:{content:'Pengeluaran\n'}, annotations:{bold:true}},
                                        {text:{content:formatIDR(expense)}, annotations:{color:'red'}}
                                    ],
                                    icon:{type:'emoji',emoji:'📤'}, color:'red_background'
                                }
                            }]}
                        },
                        {
                            type:'column', column:{ children:[{
                                type:'callout', callout:{
                                    rich_text:[
                                        {text:{content:'Saldo Akhir\n'}, annotations:{bold:true}},
                                        {text:{content:formatIDR(balance)}, annotations:{color: balUp?'green':'red'}}
                                    ],
                                    icon:{type:'emoji',emoji: balUp?'🏦':'💸'},
                                    color: balUp?'green_background':'red_background'
                                }
                            }]}
                        }
                    ]
                }
            },

            { type:'divider', divider:{} },

            // Transactions heading
            {
                type:'heading_2',
                heading_2:{ rich_text:[{text:{content:'Daftar Transaksi ('+transactions.length+' entri)'}}] }
            }
        ]
    });

    // 2. Append table — if <= 99 rows do it in one call, else chunk
    const tableRows = buildTableRows(transactions);
    const CHUNK = 98;

    if (tableRows.length <= 100) {
        await appendBlocks(page.id, [{
            type: 'table',
            table: { table_width:5, has_column_header:true, has_row_header:false, children: tableRows }
        }]);
    } else {
        // Create table with header only, then append rows in chunks
        const tableRes = await appendBlocks(page.id, [{
            type: 'table',
            table: { table_width:5, has_column_header:true, has_row_header:false, children:[tableRows[0]] }
        }]);
        const tableBlockId = tableRes.results?.[0]?.id;
        if (tableBlockId) {
            const dataRows = tableRows.slice(1);
            for (let i = 0; i < dataRows.length; i += CHUNK) {
                await appendBlocks(tableBlockId, dataRows.slice(i, i + CHUNK));
                await sleep(400);
            }
        }
    }

    return page;
}

// ─── MAIN ─────────────────────────────────────────────────────
async function main() {
    console.log('==============================================');
    console.log('  Notion Monthly Finance Page Generator');
    console.log('==============================================\n');

    // 1. Fetch data
    const results = await fetchAllTransactions();

    // 2. Parse
    const transactions = results.map(p => {
        const props = p.properties;
        return {
            id:     p.id,
            name:   props.Name?.title[0]?.plain_text || 'Tanpa Nama',
            amount: props.Jumlah?.number || 0,
            type:   props.Type?.select?.name || 'expense',
            source: props['Sumber Kas']?.select?.name || '-',
            date:   props.Tanggal?.date?.start || p.created_time
        };
    });

    // 3. Group by month
    const byMonth = {};
    transactions.forEach(t => {
        const label   = getMonthLabel(t.date);
        const sortKey = getMonthSortKey(t.date);
        if (!byMonth[label]) byMonth[label] = { sortKey, items: [] };
        byMonth[label].items.push(t);
    });

    const sortedMonths = Object.entries(byMonth).sort((a,b) => a[1].sortKey - b[1].sortKey);

    console.log('Bulan ditemukan (' + sortedMonths.length + ' bulan):');
    sortedMonths.forEach(([label, {items}]) => {
        const inc = items.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
        const exp = items.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
        console.log('  ' + label.padEnd(18) + items.length + ' transaksi | IN: ' + formatIDR(inc) + ' | OUT: ' + formatIDR(exp));
    });

    console.log('\nParent page: ' + PARENT_PAGE_ID);
    console.log('Membuat halaman per bulan...\n');

    const created = [], failed = [];

    for (const [label, {items}] of sortedMonths) {
        process.stdout.write('  [' + label + '] ...');
        try {
            const page = await createMonthlyPage(label, items);
            console.log(' BERHASIL (' + items.length + ' transaksi)');
            console.log('    URL: ' + page.url);
            created.push(label);
            await sleep(600); // rate limit safety
        } catch (err) {
            console.log(' GAGAL: ' + err.message);
            failed.push({ label, error: err.message });
        }
    }

    console.log('\n==============================================');
    console.log('  SELESAI!');
    console.log('==============================================');
    console.log('Berhasil : ' + created.length + ' halaman');
    if (failed.length > 0) {
        console.log('Gagal    : ' + failed.length + ' halaman');
        failed.forEach(f => console.log('  - ' + f.label + ': ' + f.error));
    }
    console.log('\nBuka Notion -> "Laporan Keuangan Bulanan"\n');
}

main().catch(err => {
    console.error('\nFATAL ERROR:', err.message);
    process.exit(1);
});
