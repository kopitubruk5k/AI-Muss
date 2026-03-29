import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_TRANS_DB_ID;

async function fetchTransactions() {
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sorts: [{ property: 'Tanggal', direction: 'descending' }],
        page_size: 100,
      }),
      cache: 'no-store',
    });
    const data = await res.json();
    if (data.object === 'error') return [];

    return data.results.map((page) => {
      const props = page.properties;
      return {
        name: props.Name?.title[0]?.plain_text || 'Tanpa Nama',
        amount: props.Jumlah?.number || 0,
        type: props.Type?.select?.name || 'income',
        source: props['Sumber Kas']?.select?.name || 'cash',
        date: props.Tanggal?.date?.start || page.created_time,
      };
    });
  } catch {
    return [];
  }
}

function buildFinanceSummary(transactions) {
  if (!transactions.length) return 'Tidak ada data transaksi.';

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const fmt = (n) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  const recentList = transactions
    .slice(0, 10)
    .map((t) => `- ${t.date?.slice(0, 10)} | ${t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} | ${t.name} | ${fmt(t.amount)} | ${t.source}`)
    .join('\n');

  return `
Total Pemasukan: ${fmt(totalIncome)}
Total Pengeluaran: ${fmt(totalExpense)}
Saldo: ${fmt(balance)}
Jumlah transaksi: ${transactions.length}

10 Transaksi Terakhir:
${recentList}
  `.trim();
}

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY belum dikonfigurasi di .env.local' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const { message, history = [], includeFinance = false } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let systemInstruction = `Kamu adalah asisten AI yang ramah, cerdas, dan serba bisa bernama FinanceMU Assistant. 
Kamu berbicara dalam Bahasa Indonesia secara natural dan membantu menjawab berbagai pertanyaan dari pengguna, 
baik tentang keuangan, kehidupan sehari-hari, pengetahuan umum, maupun hal lainnya.
Jawab dengan jelas, ringkas, dan gunakan format yang mudah dibaca (gunakan poin/daftar jika diperlukan).`;

    if (includeFinance) {
      const transactions = await fetchTransactions();
      const summary = buildFinanceSummary(transactions);
      systemInstruction += `\n\nBerikut adalah data keuangan terkini pengguna (gunakan ini jika ditanya tentang keuangan mereka):\n${summary}`;
    }

    // Build chat history for Gemini (limit to last 10 turns to save tokens)
    const geminiHistory = history.slice(-10).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const chat = ai.chats.create({
      model: 'gemini-2.0-flash',
      config: { systemInstruction },
      history: geminiHistory,
    });

    const response = await chat.sendMessage({ message });
    const text = response.text;

    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error('Chat API Error:', error);

    // Detect rate limit (429)
    const msg = error?.message || '';
    if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')) {
      return NextResponse.json({
        error: 'Batas penggunaan API tercapai (rate limit). Tunggu beberapa detik lalu coba lagi.'
      }, { status: 429 });
    }

    return NextResponse.json({ error: 'Gagal menghubungi AI. Pastikan API key sudah benar.' }, { status: 500 });
  }
}
