"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FaWallet, FaBuildingColumns, FaArrowTrendUp, FaArrowTrendDown,
  FaPlus, FaMinus, FaPaperPlane, FaChartPie, FaRectangleList,
  FaTrashCan, FaCalendar, FaRegFolderOpen, FaChartSimple,
  FaListCheck, FaClock, FaCheck, FaCalendarDays, FaChevronRight,
} from "react-icons/fa6";
import toast from "react-hot-toast";
import DatePicker, { registerLocale } from "react-datepicker";
import id from "date-fns/locale/id";
import "react-datepicker/dist/react-datepicker.css";
import {
  Chart as ChartJS, ArcElement, CategoryScale,
  LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";

// ─── Setup ───────────────────────────────────────────────────
registerLocale("id", id);
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);
ChartJS.defaults.color = "#94a3b8";
ChartJS.defaults.font.family = "var(--font-outfit)";

// ─── Konstanta ────────────────────────────────────────────────
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// ─── Utils ────────────────────────────────────────────────────
const formatIDR = (num) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num);

// ─── Komponen Utama ───────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // State transaksi
  const [transactions, setTransactions] = useState([]);
  const [text, setText]     = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType]     = useState("income");
  const [source, setSource] = useState("cash");
  const [txDate, setTxDate] = useState(new Date());

  // State filter & pagination riwayat
  const [txFilter, setTxFilter] = useState("all");
  const [txLimit, setTxLimit]   = useState(10);

  // State bulan untuk chart
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // State kegiatan / pengingat
  const [activities, setActivities] = useState([]);
  const [actTitle, setActTitle]     = useState("");
  const [actTime, setActTime]       = useState(new Date());

  // ─── Load Data Awal ────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const [resTx, resAct] = await Promise.all([
          fetch("/api/transactions"),
          fetch("/api/activities"),
        ]);
        if (resTx.ok)  setTransactions(await resTx.json());
        if (resAct.ok) setActivities(await resAct.json());
      } catch (e) {
        console.error("Gagal memuat data:", e);
      }
    };
    loadData();
    setMounted(true);
  }, []);

  // ─── Pengingat Otomatis (cek tiap 10 detik) ────────────────
  useEffect(() => {
    if (!mounted || activities.length === 0) return;

    const interval = setInterval(() => {
      const now = new Date();
      let hasUpdates = false;

      const updatedActs = activities.map((act) => {
        if (act.completed) return act;

        const actTimeObj = new Date(act.time);
        if (now < actTimeObj) return act;

        // Tampilkan toast pengingat
        toast.custom((t) => (
          <div className={`${t.visible ? "animate-enter" : "animate-leave"} max-w-md w-full bg-slate-800 shadow-xl rounded-2xl pointer-events-auto flex ring-1 ring-primary/20`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5 mt-1 text-2xl text-primary">
                  <FaClock />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-white">Pengingat Kegiatan!</p>
                  <p className="mt-1 text-sm text-slate-300">Waktunya: <strong>{act.title}</strong></p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-white/10">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-primary hover:text-primary-glow focus:outline-none"
              >
                Tutup
              </button>
            </div>
          </div>
        ), { duration: 10000 });

        // Tandai selesai di backend (fire-and-forget)
        fetch(`/api/activities?id=${act.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        });

        hasUpdates = true;
        return { ...act, completed: true };
      });

      if (hasUpdates) setActivities(updatedActs);
    }, 10000);

    return () => clearInterval(interval);
  }, [mounted, activities]);

  // ─── Kalkulasi Ringkasan Global ────────────────────────────
  const globalIncome  = transactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const globalExpense = transactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const globalBalance = globalIncome - globalExpense;

  // ─── Kalkulasi Bulanan ─────────────────────────────────────
  const filteredByMonth = transactions.filter(t => {
    const d = new Date(t.createdAt || t.id);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === selectedMonth;
  });
  const monthlyIncome  = filteredByMonth.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const monthlyExpense = filteredByMonth.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);

  // ─── Handler Transaksi ─────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text || !amount) return;

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text, type, source,
          amount: Math.abs(parseFloat(amount)),
          date: txDate.toISOString(),
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setTransactions([saved, ...transactions]);
        setText(""); setAmount(""); setType("income"); setSource("cash"); setTxDate(new Date());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteTransaction = async (id) => {
    try {
      const res = await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
      if (res.ok) setTransactions(transactions.filter(t => t.id !== id));
    } catch (e) { console.error(e); }
  };

  const clearAll = async () => {
    try {
      const res = await fetch("/api/transactions?clearAll=true", { method: "DELETE" });
      if (res.ok) setTransactions([]);
    } catch (e) { console.error(e); }
  };

  // ─── Handler Kegiatan ──────────────────────────────────────
  const handleAddActivity = async (e) => {
    e.preventDefault();
    if (!actTitle || !actTime) return;

    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: actTitle, time: actTime.toISOString() }),
      });
      if (res.ok) {
        const saved = await res.json();
        setActivities([...activities, saved].sort((a, b) => new Date(a.time) - new Date(b.time)));
        setActTitle("");
        setActTime(new Date());
        toast.success("Kegiatan berhasil ditambahkan!");
      }
    } catch (e) { console.error(e); }
  };

  const deleteActivity = async (id) => {
    try {
      const res = await fetch(`/api/activities?id=${id}`, { method: "DELETE" });
      if (res.ok) setActivities(activities.filter(a => a.id !== id));
    } catch (e) { console.error(e); }
  };

  // Cegah hydration mismatch
  if (!mounted) return null;

  // ─── Data Chart ────────────────────────────────────────────
  const globalChartData = {
    labels: ["Pemasukan", "Pengeluaran"],
    datasets: [{
      data: [globalIncome, globalExpense],
      backgroundColor: ["rgba(16,185,129,0.8)", "rgba(244,63,94,0.8)"],
      borderColor: ["#10b981", "#f43f5e"],
      borderWidth: 2,
      hoverOffset: 6,
    }],
  };

  const monthlyChartData = {
    labels: ["Pemasukan", "Pengeluaran"],
    datasets: [{
      data: [monthlyIncome, monthlyExpense],
      backgroundColor: ["rgba(96,165,250,0.8)", "rgba(251,146,60,0.8)"],
      borderColor: ["#60a5fa", "#fb923c"],
      borderWidth: 2,
      hoverOffset: 6,
    }],
  };

  const filteredHistory     = transactions.filter(tx => txFilter === "all" || tx.type === txFilter);
  const displayedHistory    = filteredHistory.slice(0, txLimit);

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto p-8 flex flex-col gap-8">

      {/* ── Header ── */}
      <header className="text-center py-4 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 flex justify-center items-center gap-3">
          <FaWallet className="text-primary" />
          <span>Finance<span className="bg-gradient-to-br from-purple-500 to-blue-500 bg-clip-text text-transparent">MU</span></span>
        </h1>
        <p className="text-slate-400 text-lg mb-4">Sistem Pencatat Keuangan &amp; Analisis Grafik</p>
      </header>

      <main className="flex flex-col gap-8">

        {/* ── Ringkasan Total Saldo ── */}
        <div className="flex justify-between items-center mb-[-0.5rem] mt-2">
          <h2 className="text-xl font-bold text-slate-200">Ringkasan Total Saldo</h2>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Saldo */}
          <div className="glass-panel p-6 rounded-2xl flex items-center gap-6 group hover:scale-[1.02] transition-transform shadow-lg border-t-4 border-t-primary">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl text-primary">
              <FaBuildingColumns />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-1">Total Saldo Seluruhnya</h3>
              <h2 className="text-3xl font-bold">{formatIDR(globalBalance)}</h2>
            </div>
          </div>

          {/* Total Pemasukan */}
          <div className="glass-panel p-6 rounded-2xl flex items-center gap-6 group hover:scale-[1.02] transition-transform shadow-lg border-t-4 border-t-income">
            <div className="w-16 h-16 rounded-full bg-income/10 flex items-center justify-center text-3xl text-income">
              <FaArrowTrendUp />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-1">Total Pemasukan</h3>
              <h2 className="text-3xl font-bold">{formatIDR(globalIncome)}</h2>
            </div>
          </div>

          {/* Total Pengeluaran */}
          <div className="glass-panel p-6 rounded-2xl flex items-center gap-6 group hover:scale-[1.02] transition-transform shadow-lg border-t-4 border-t-expense">
            <div className="w-16 h-16 rounded-full bg-expense/10 flex items-center justify-center text-3xl text-expense">
              <FaArrowTrendDown />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-1">Total Pengeluaran</h3>
              <h2 className="text-3xl font-bold">{formatIDR(globalExpense)}</h2>
            </div>
          </div>
        </section>

        {/* ── Form Tambah Transaksi & Chart ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Form */}
          <div className="glass-panel p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <FaPlus className="text-primary text-xl" /> Tambah Transaksi
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              {/* Jenis Transaksi */}
              <div>
                <label className="block mb-2 text-sm text-slate-400">Jenis Transaksi</label>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setType("income")}
                    className={`flex-1 flex justify-center items-center gap-2 p-3 rounded-xl border transition-all font-semibold
                      ${type === "income" ? "bg-income/20 border-income text-white" : "bg-slate-900/60 border-white/10 text-slate-400 hover:bg-slate-800"}`}>
                    <FaPlus /> Pemasukan
                  </button>
                  <button type="button" onClick={() => setType("expense")}
                    className={`flex-1 flex justify-center items-center gap-2 p-3 rounded-xl border transition-all font-semibold
                      ${type === "expense" ? "bg-expense/20 border-expense text-white" : "bg-slate-900/60 border-white/10 text-slate-400 hover:bg-slate-800"}`}>
                    <FaMinus /> Pengeluaran
                  </button>
                </div>
              </div>

              {/* Tanggal Transaksi */}
              <div>
                <label className="block mb-2 text-sm text-slate-400">Tanggal Transaksi</label>
                <DatePicker
                  selected={txDate}
                  onChange={(date) => setTxDate(date)}
                  dateFormat="d MMMM yyyy"
                  locale="id"
                  className="w-full p-4 bg-slate-900/60 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/30 transition-all font-sans"
                  wrapperClassName="w-full"
                  required
                />
              </div>

              {/* Sumber Dana */}
              <div>
                <label className="block mb-2 text-sm text-slate-400">Sumber Dana</label>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setSource("cash")}
                    className={`flex-1 flex justify-center items-center gap-2 p-3 rounded-xl border transition-all font-semibold
                      ${source === "cash" ? "bg-indigo-500/20 border-indigo-500 text-white" : "bg-slate-900/60 border-white/10 text-slate-400 hover:bg-slate-800"}`}>
                    Tunai (Cash)
                  </button>
                  <button type="button" onClick={() => setSource("bank")}
                    className={`flex-1 flex justify-center items-center gap-2 p-3 rounded-xl border transition-all font-semibold
                      ${source === "bank" ? "bg-cyan-500/20 border-cyan-500 text-white" : "bg-slate-900/60 border-white/10 text-slate-400 hover:bg-slate-800"}`}>
                    <FaBuildingColumns /> Bank
                  </button>
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block mb-2 text-sm text-slate-400">Keterangan / Deskripsi</label>
                <input
                  type="text" value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="Gaji bulanan, makan, listrik..."
                  className="w-full p-4 bg-slate-900/60 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/30 transition-all font-sans"
                  required
                />
              </div>

              {/* Jumlah */}
              <div>
                <label className="block mb-2 text-sm text-slate-400">Jumlah (Rp)</label>
                <input
                  type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0" min="1"
                  className="w-full p-4 bg-slate-900/60 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/30 transition-all font-sans"
                  required
                />
              </div>

              <button type="submit"
                className="mt-2 w-full p-4 bg-gradient-to-r from-primary to-purple-600 hover:to-purple-500 rounded-xl font-bold text-lg flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] transition-all hover:-translate-y-1">
                Simpan Keuangan <FaPaperPlane />
              </button>
            </form>
          </div>

          {/* Charts */}
          <div className="flex flex-col gap-6">

            {/* Chart Akumulasi Global */}
            <div className="glass-panel p-8 rounded-2xl flex flex-col flex-1">
              <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                  <FaChartPie className="text-primary text-xl" /> Akumulasi Keseluruhan
                </h2>
              </div>
              <div className="flex-1 flex items-center justify-center relative min-h-[250px]">
                {globalIncome === 0 && globalExpense === 0 ? (
                  <div className="flex flex-col items-center justify-center text-slate-500 gap-4">
                    <FaChartSimple className="text-6xl opacity-50" />
                    <p>Belum ada data visual</p>
                  </div>
                ) : (
                  <div className="w-full h-full relative" style={{ height: "250px" }}>
                    <Doughnut
                      data={globalChartData}
                      options={{ maintainAspectRatio: false, cutout: "75%", plugins: { legend: { position: "bottom", labels: { padding: 25, usePointStyle: true } } } }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-[50px]">
                      <span className="text-sm text-slate-400">Total Akumulasi</span>
                      <span className="text-lg font-bold">{formatIDR(globalIncome + globalExpense)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chart Bulanan */}
            <div className="glass-panel p-8 rounded-2xl flex flex-col flex-1">
              <div className="flex flex-col xl:flex-row justify-between xl:items-center items-start gap-4 mb-6 border-b border-white/10 pb-4">
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                  <FaChartPie className="text-blue-400 text-xl" /> Bulan Ini
                </h2>
                <input
                  type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                  className="p-2 bg-slate-900/80 border border-white/10 rounded-xl focus:outline-none focus:border-blue-400 text-slate-300 font-medium text-sm"
                />
              </div>
              <div className="flex-1 flex items-center justify-center relative min-h-[250px]">
                {monthlyIncome === 0 && monthlyExpense === 0 ? (
                  <div className="flex flex-col items-center justify-center text-slate-500 gap-4">
                    <FaChartSimple className="text-6xl opacity-50" />
                    <p>Kosong bulan ini</p>
                  </div>
                ) : (
                  <div className="w-full h-full relative" style={{ height: "250px" }}>
                    <Bar
                      data={monthlyChartData}
                      options={{
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } },
                          x: { grid: { display: false } },
                        },
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* ── Riwayat Transaksi ── */}
        <section className="glass-panel p-8 rounded-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 border-b border-white/10 pb-4 gap-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <FaRectangleList className="text-primary text-xl" /> Riwayat Transaksi Utuh
            </h2>
            <div className="flex flex-wrap items-center gap-3">

              {/* Filter Jenis */}
              <div className="flex bg-slate-900/60 rounded-lg p-1 border border-white/10">
                {["all", "income", "expense"].map((f) => (
                  <button key={f} onClick={() => setTxFilter(f)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium
                      ${txFilter === f
                        ? f === "all" ? "bg-primary text-white shadow-md"
                          : f === "income" ? "bg-income text-white shadow-md"
                          : "bg-expense text-white shadow-md"
                        : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                    {f === "all" ? "Semua" : f === "income" ? "Pemasukan" : "Pengeluaran"}
                  </button>
                ))}
              </div>

              {/* Batas tampil */}
              <select
                value={txLimit} onChange={(e) => setTxLimit(Number(e.target.value))}
                className="bg-slate-900/80 border border-white/10 rounded-lg py-1.5 px-3 text-sm text-slate-300 focus:outline-none focus:border-primary cursor-pointer hover:border-white/20 transition-colors"
                title="Tampilkan jumlah data">
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} Data</option>)}
              </select>

              {/* Hapus Semua */}
              {transactions.length > 0 && (
                <button onClick={clearAll}
                  className="text-sm bg-slate-900/60 border border-white/10 px-4 py-1.5 rounded-lg hover:border-expense hover:text-expense hover:bg-expense/10 transition-all font-medium">
                  Hapus Semua
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {displayedHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-4 py-12">
                <FaRegFolderOpen className="text-6xl opacity-50" />
                <p>{transactions.length === 0 ? "Belum ada riwayat transaksi" : "Tidak ada transaksi untuk filter ini"}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {displayedHistory.map(tx => (
                  <li key={tx.id}
                    className={`p-5 rounded-xl bg-slate-900/40 border border-white/5 hover:bg-slate-800/80 transition-all flex justify-between items-center border-l-4 group
                      ${tx.type === "income" ? "border-l-income" : "border-l-expense"}`}>
                    <div>
                      <h4 className="font-medium text-lg mb-1 flex items-center gap-2">
                        {tx.text}
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border
                          ${tx.source === "bank"
                            ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                            : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"}`}>
                          {tx.source === "bank" ? "BANK" : "CASH"}
                        </span>
                      </h4>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <FaCalendar />
                        {new Date(tx.createdAt || tx.id).toLocaleString("id-ID", {
                          timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short", hour12: false,
                        })} WIB
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className={`font-bold text-xl ${tx.type === "income" ? "text-income" : "text-expense"}`}>
                        {tx.type === "income" ? "+" : "-"} {formatIDR(tx.amount)}
                      </span>
                      <button onClick={() => deleteTransaction(tx.id)} title="Hapus"
                        className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-expense/10 hover:text-expense transition-colors">
                        <FaTrashCan />
                      </button>
                    </div>
                  </li>
                ))}

                {filteredHistory.length > txLimit && (
                  <li className="text-center pt-4 pb-2">
                    <p className="text-sm text-slate-400">
                      Menampilkan {txLimit} dari {filteredHistory.length} data. Ubah batas tampilan di atas untuk melihat lebih banyak.
                    </p>
                  </li>
                )}
              </ul>
            )}
          </div>
        </section>

        {/* ── Laporan Per Bulan ── */}
        <section className="glass-panel p-8 rounded-2xl">
          <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
            <FaCalendarDays className="text-primary text-xl" />
            <h2 className="text-2xl font-semibold">Laporan Per Bulan</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {(() => {
              // Tampilkan 12 bulan terakhir
              const now = new Date();
              return Array.from({ length: 12 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                return { key, label: MONTH_NAMES[d.getMonth()], year: d.getFullYear() };
              }).map(({ key, label, year }) => (
                <button key={key} onClick={() => router.push(`/monthly/${key}`)}
                  className="group flex flex-col items-center gap-1 p-4 rounded-xl bg-slate-900/40 border border-white/5 hover:border-primary/50 hover:bg-primary/10 transition-all hover:-translate-y-1">
                  <span className="text-primary text-xl"><FaCalendarDays /></span>
                  <span className="font-semibold text-sm text-white">{label}</span>
                  <span className="text-xs text-slate-500">{year}</span>
                  <FaChevronRight className="text-slate-500 group-hover:text-primary transition-colors text-xs mt-1" />
                </button>
              ));
            })()}
          </div>
        </section>

        {/* ── Jadwal & Pengingat ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">

          {/* Form Tambah Jadwal */}
          <div className="glass-panel p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <FaClock className="text-blue-400 text-xl" /> Tambah Jadwal &amp; Pengingat
              </h2>
            </div>
            <form onSubmit={handleAddActivity} className="flex flex-col gap-5">
              <div>
                <label className="block mb-2 text-sm text-slate-400">Nama Kegiatan</label>
                <input
                  type="text" value={actTitle} onChange={(e) => setActTitle(e.target.value)}
                  placeholder="Contoh: Bayar Tagihan Listrik"
                  className="w-full p-4 bg-slate-900/60 border border-white/10 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/30 transition-all font-sans"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 text-sm text-slate-400">Waktu Pelaksanaan</label>
                <DatePicker
                  selected={actTime} onChange={(date) => setActTime(date)}
                  showTimeInput timeInputLabel="Waktu:"
                  dateFormat="d MMMM yyyy, HH:mm" locale="id"
                  className="w-full p-4 bg-slate-900/60 border border-white/10 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/30 transition-all font-sans"
                  wrapperClassName="w-full"
                  required
                />
              </div>
              <button type="submit"
                className="mt-2 w-full p-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:to-cyan-400 rounded-xl font-bold text-lg flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:-translate-y-1">
                Simpan Jadwal
              </button>
            </form>
          </div>

          {/* Daftar Kegiatan */}
          <div className="glass-panel p-8 rounded-2xl flex flex-col">
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <FaListCheck className="text-blue-400 text-xl" /> Daftar Kegiatan
              </h2>
            </div>
            <div className="flex-1 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-500 gap-4 h-full py-8">
                  <FaRegFolderOpen className="text-6xl opacity-50" />
                  <p>Belum ada jadwal kegiatan</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {activities.map(act => (
                    <li key={act.id}
                      className={`p-4 rounded-xl border transition-all flex justify-between items-center group
                        ${act.completed ? "bg-slate-900/30 border-white/5 opacity-60" : "bg-slate-800/80 border-blue-400/30 hover:border-blue-400/60"}`}>
                      <div>
                        <h4 className={`font-medium text-lg mb-1 ${act.completed ? "line-through text-slate-400" : "text-white"}`}>
                          {act.title}
                        </h4>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <FaClock />
                          {new Date(act.time).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short", hour12: false,
                          })} WIB
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xl">
                        {act.completed && <FaCheck className="text-income mr-2" title="Selesai" />}
                        <button onClick={() => deleteActivity(act.id)} title="Hapus"
                          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-expense/10 hover:text-expense transition-colors">
                          <FaTrashCan />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="text-center py-6 text-slate-500 text-sm">
        <p>&copy; {new Date().getFullYear()} FinanceMU. Built with Next.js &amp; Tailwind CSS.</p>
      </footer>

    </div>
  );
}
