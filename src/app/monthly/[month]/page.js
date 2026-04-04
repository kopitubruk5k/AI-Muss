"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FaWallet, FaArrowTrendUp, FaArrowTrendDown, FaCalendar,
  FaBuildingColumns, FaTrashCan, FaChartPie, FaChevronLeft,
  FaChevronRight, FaRegFolderOpen, FaChartSimple
} from "react-icons/fa6";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);
ChartJS.defaults.color = "#94a3b8";
ChartJS.defaults.font.family = "var(--font-outfit)";

const formatIDR = (num) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function getMonthLabel(monthStr) {
  const [year, mon] = monthStr.split("-").map(Number);
  return `${MONTH_NAMES[mon - 1]} ${year}`;
}

function prevMonth(monthStr) {
  const [year, mon] = monthStr.split("-").map(Number);
  const d = new Date(year, mon - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(monthStr) {
  const [year, mon] = monthStr.split("-").map(Number);
  const d = new Date(year, mon, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthlyPage() {
  const params = useParams();
  const router = useRouter();
  const month = params.month; // "2026-03"

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/transactions?month=${month}`);
        if (res.ok) setTransactions(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [month]);

  const deleteTransaction = async (id) => {
    try {
      const res = await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
      if (res.ok) setTransactions(transactions.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (!mounted) return null;

  const income = transactions.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
  const balance = income - expense;

  const chartData = {
    labels: ["Pemasukan", "Pengeluaran"],
    datasets: [{
      data: [income, expense],
      backgroundColor: ["rgba(16, 185, 129, 0.8)", "rgba(244, 63, 94, 0.8)"],
      borderColor: ["#10b981", "#f43f5e"],
      borderWidth: 2,
      hoverOffset: 6,
    }]
  };

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-8">
      {/* Header */}
      <header className="animate-fade-in">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 group text-sm"
        >
          <FaChevronLeft className="group-hover:-translate-x-1 transition-transform" />
          Kembali ke Dashboard
        </button>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <FaWallet className="text-primary text-3xl" />
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Finance<span className="text-white">MU</span>
              </h1>
              <p className="text-slate-400 text-sm">Laporan Bulanan</p>
            </div>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-3 glass-panel px-5 py-3 rounded-2xl">
            <button
              onClick={() => router.push(`/monthly/${prevMonth(month)}`)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
              title="Bulan Sebelumnya"
            >
              <FaChevronLeft />
            </button>
            <span className="text-lg font-bold text-white min-w-[160px] text-center">
              {getMonthLabel(month)}
            </span>
            <button
              onClick={() => router.push(`/monthly/${nextMonth(month)}`)}
              disabled={month >= currentMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Bulan Berikutnya"
            >
              <FaChevronRight />
            </button>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-panel p-5 rounded-2xl flex items-center gap-5 border-t-4 border-t-primary hover:scale-[1.02] transition-transform">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-2xl text-primary">
            <FaBuildingColumns />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">Saldo Bulan Ini</p>
            <p className={`text-2xl font-bold ${balance >= 0 ? "text-white" : "text-expense"}`}>{formatIDR(balance)}</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center gap-5 border-t-4 border-t-income hover:scale-[1.02] transition-transform">
          <div className="w-14 h-14 rounded-full bg-income/10 flex items-center justify-center text-2xl text-income">
            <FaArrowTrendUp />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">Total Pemasukan</p>
            <p className="text-2xl font-bold text-income">{formatIDR(income)}</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center gap-5 border-t-4 border-t-expense hover:scale-[1.02] transition-transform">
          <div className="w-14 h-14 rounded-full bg-expense/10 flex items-center justify-center text-2xl text-expense">
            <FaArrowTrendDown />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">Total Pengeluaran</p>
            <p className="text-2xl font-bold text-expense">{formatIDR(expense)}</p>
          </div>
        </div>
      </section>

      {/* Chart + List */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center">
          <div className="flex items-center gap-2 mb-5 self-start">
            <FaChartPie className="text-primary" />
            <h2 className="text-lg font-semibold">Distribusi</h2>
          </div>
          {income === 0 && expense === 0 ? (
            <div className="flex flex-col items-center justify-center text-slate-500 gap-3 h-full py-8">
              <FaChartSimple className="text-5xl opacity-40" />
              <p className="text-sm">Belum ada data</p>
            </div>
          ) : (
            <div className="relative w-full" style={{ height: "220px" }}>
              <Doughnut
                data={chartData}
                options={{
                  maintainAspectRatio: false,
                  cutout: "72%",
                  plugins: { legend: { position: "bottom", labels: { padding: 20, usePointStyle: true } } }
                }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                <span className="text-xs text-slate-400">Total</span>
                <span className="text-sm font-bold">{formatIDR(income + expense)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Transaction List */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 flex flex-col">
          <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-3">
            Riwayat Transaksi
            <span className="ml-2 text-sm font-normal text-slate-400">({transactions.length} data)</span>
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
              Memuat data...
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-slate-500 gap-4 py-12">
              <FaRegFolderOpen className="text-5xl opacity-40" />
              <p>Tidak ada transaksi di bulan ini</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className={`flex justify-between items-center p-4 rounded-xl bg-slate-900/40 border border-white/5 hover:bg-slate-800/60 transition-all border-l-4 group
                    ${tx.type === "income" ? "border-l-income" : "border-l-expense"}`}
                >
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {tx.text}
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border
                        ${tx.source === "bank"
                          ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                          : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"}`}>
                        {tx.source === "bank" ? "BANK" : "CASH"}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <FaCalendar />
                      {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                        timeZone: "Asia/Jakarta", dateStyle: "medium"
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-bold text-lg ${tx.type === "income" ? "text-income" : "text-expense"}`}>
                      {tx.type === "income" ? "+" : "-"} {formatIDR(tx.amount)}
                    </span>
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-expense/10 hover:text-expense transition-colors opacity-0 group-hover:opacity-100"
                      title="Hapus"
                    >
                      <FaTrashCan />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
