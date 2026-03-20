"use client";

import { useState, useEffect } from "react";
import {
  FaWallet, FaBuildingColumns, FaArrowTrendUp, FaArrowTrendDown,
  FaPlus, FaMinus, FaPaperPlane, FaChartPie, FaRectangleList,
  FaTrashCan, FaCalendar, FaRegFolderOpen, FaChartSimple,
  FaListCheck, FaClock, FaCheck
} from "react-icons/fa6";
import toast from "react-hot-toast";
import DatePicker, { registerLocale } from "react-datepicker";
import id from "date-fns/locale/id";
import "react-datepicker/dist/react-datepicker.css";
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";

registerLocale("id", id);

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);
ChartJS.defaults.color = "#94a3b8";
ChartJS.defaults.font.family = "var(--font-outfit)";

const formatIDR = (num) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num);
};

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("income");
  const [source, setSource] = useState("cash"); // 'cash' atau 'bank'
  const [txDate, setTxDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Transactions Filter & Pagination State
  const [txFilter, setTxFilter] = useState("all");
  const [txLimit, setTxLimit] = useState(10);

  // Activities State
  const [activities, setActivities] = useState([]);
  const [actTitle, setActTitle] = useState("");
  const [actTime, setActTime] = useState(new Date());

  useEffect(() => {
    // Initial load from API
    const loadData = async () => {
      try {
        const [resTx, resAct] = await Promise.all([
          fetch("/api/transactions"),
          fetch("/api/activities")
        ]);
        if (resTx.ok) setTransactions(await resTx.json());
        if (resAct.ok) setActivities(await resAct.json());
      } catch (e) {
        console.error("Failed to fetch data", e);
      }
    };
    loadData();
    setMounted(true);
  }, []);

  // Reminder Checker Interval
  useEffect(() => {
    if (!mounted || activities.length === 0) return;

    const interval = setInterval(() => {
      const now = new Date();
      let hasUpdates = false;
      const updatedActs = activities.map(act => {
        if (!act.completed) {
          const actTimeObj = new Date(act.time);
          // Check if current time has passed the scheduled time
          if (now >= actTimeObj) {
            // Trigger Toast!
            toast.custom((t) => (
              <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-800 shadow-xl rounded-2xl pointer-events-auto flex ring-1 ring-primary/20`}>
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
                  <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-primary hover:text-primary-glow focus:outline-none">
                    Tutup
                  </button>
                </div>
              </div>
            ), { duration: 10000 });

            hasUpdates = true;
            // Mark as completed in backend via API call (fire and forget for this demo)
            fetch(`/api/activities?id=${act.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ completed: true })
            });

            return { ...act, completed: true };
          }
        }
        return act;
      });

      if (hasUpdates) setActivities(updatedActs);
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [mounted, activities]);

  // Monthly Chart Calculations
  const filteredTransactions = transactions.filter(t => {
    const tDate = new Date(t.createdAt || t.id);
    const tMonth = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
    return tMonth === selectedMonth;
  });

  const monthlyIncome = filteredTransactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const monthlyExpense = filteredTransactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);

  // Global Chart & Summary Calculations
  const globalIncome = transactions.filter(t => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const globalExpense = transactions.filter(t => t.type === "expense").reduce((acc, t) => acc + t.amount, 0);
  const globalBalance = globalIncome - globalExpense;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text || !amount) return;

    const newTx = {
      text,
      amount: Math.abs(parseFloat(amount)),
      type,
      source,
      date: txDate.toISOString(),
    };

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTx),
      });
      if (res.ok) {
        const savedTx = await res.json();
        setTransactions([savedTx, ...transactions]);
        setText("");
        setAmount("");
        setType("income");
        setSource("cash");
        setTxDate(new Date());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteTransaction = async (id) => {
    try {
      const res = await fetch(`/api/transactions?id=${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setTransactions(transactions.filter(t => t.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const clearAll = async () => {
    // In a real app backend, we'd add an endpoint for clearing all. 
    // For now we'll simulate by deleting them one by one or handling via another DELETE approach
    try {
      const res = await fetch(`/api/transactions?clearAll=true`, { method: "DELETE" });
      if (res.ok) setTransactions([]);
    } catch (e) {
      console.error(e);
    }
  };

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
        const savedAct = await res.json();
        const newActs = [...activities, savedAct].sort((a, b) => new Date(a.time) - new Date(b.time));
        setActivities(newActs);
        setActTitle("");
        setActTime(new Date());
        toast.success("Kegiatan berhasil ditambahkan!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteActivity = async (id) => {
    try {
      const res = await fetch(`/api/activities?id=${id}`, { method: "DELETE" });
      if (res.ok) setActivities(activities.filter(a => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (!mounted) return null; // Prevent hydration errors with local states

  const globalChartData = {
    labels: ["Pemasukan", "Pengeluaran"],
    datasets: [{
      data: [globalIncome, globalExpense],
      backgroundColor: ["rgba(16, 185, 129, 0.8)", "rgba(244, 63, 94, 0.8)"],
      borderColor: ["#10b981", "#f43f5e"],
      borderWidth: 2,
      hoverOffset: 6,
    }]
  };

  const monthlyChartData = {
    labels: ["Pemasukan", "Pengeluaran"],
    datasets: [{
      data: [monthlyIncome, monthlyExpense],
      backgroundColor: ["rgba(96, 165, 250, 0.8)", "rgba(251, 146, 60, 0.8)"],
      borderColor: ["#60a5fa", "#fb923c"],
      borderWidth: 2,
      hoverOffset: 6,
    }]
  };

  const filteredHistoryList = transactions.filter(tx => txFilter === "all" || tx.type === txFilter);
  const displayedTransactions = filteredHistoryList.slice(0, txLimit);

  return (
    <div className="max-w-6xl mx-auto p-8 flex flex-col gap-8">
      {/* Header */}
      <header className="text-center py-4 animate-fade-in relative">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 flex justify-center items-center gap-3">
          <FaWallet className="text-primary" />
          Finance <span className="bg-gradient-to-br from-purple-500 to-blue-500 bg-clip-text text-transparent">Muss</span>
        </h1>
        <p className="text-slate-400 text-lg mb-4">Sistem Pencatat Keuangan & Analisis Grafik</p>
      </header>

      <main className="flex flex-col gap-8">
        <div className="flex justify-between items-center mb-[-0.5rem] mt-2">
          <h2 className="text-xl font-bold text-slate-200">Ringkasan Total Saldo</h2>
        </div>

        {/* Summary Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-2xl flex items-center gap-6 relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-lg border-t-4 border-t-primary">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl text-primary">
              <FaBuildingColumns />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-1">Total Saldo Seluruhnya</h3>
              <h2 className="text-3xl font-bold">{formatIDR(globalBalance)}</h2>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl flex items-center gap-6 relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-lg border-t-4 border-t-income">
            <div className="w-16 h-16 rounded-full bg-income/10 flex items-center justify-center text-3xl text-income">
              <FaArrowTrendUp />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-1">Total Pemasukan</h3>
              <h2 className="text-3xl font-bold">{formatIDR(globalIncome)}</h2>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl flex items-center gap-6 relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-lg border-t-4 border-t-expense">
            <div className="w-16 h-16 rounded-full bg-expense/10 flex items-center justify-center text-3xl text-expense">
              <FaArrowTrendDown />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-1">Total Pengeluaran</h3>
              <h2 className="text-3xl font-bold">{formatIDR(globalExpense)}</h2>
            </div>
          </div>
        </section>

        {/* Interactive Dashboard - Form & Chart */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="glass-panel p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2"><FaPlus className="text-primary text-xl" /> Tambah Transaksi</h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block mb-2 text-sm text-slate-400">Jenis Transaksi</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setType("income")}
                    className={`flex-1 flex justify-center items-center gap-2 p-3 rounded-xl border transition-all font-semibold
                      ${type === 'income' ? 'bg-income/20 border-income text-white' : 'bg-slate-900/60 border-white/10 text-slate-400 hover:bg-slate-800'}`}
                  >
                    <FaPlus /> Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`flex-1 flex justify-center items-center gap-2 p-3 rounded-xl border transition-all font-semibold
                      ${type === 'expense' ? 'bg-expense/20 border-expense text-white' : 'bg-slate-900/60 border-white/10 text-slate-400 hover:bg-slate-800'}`}
                  >
                    <FaMinus /> Pengeluaran
                  </button>
                </div>
              </div>

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

              <div>
                <label className="block mb-2 text-sm text-slate-400">Sumber Dana</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setSource("cash")}
                    className={`flex-1 flex justify-center items-center gap-2 p-3 rounded-xl border transition-all font-semibold
                      ${source === 'cash' ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-900/60 border-white/10 text-slate-400 hover:bg-slate-800'}`}
                  >
                    Tunai (Cash)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource("bank")}
                    className={`flex-1 flex justify-center items-center gap-2 p-3 rounded-xl border transition-all font-semibold
                      ${source === 'bank' ? 'bg-cyan-500/20 border-cyan-500 text-white' : 'bg-slate-900/60 border-white/10 text-slate-400 hover:bg-slate-800'}`}
                  >
                    <FaBuildingColumns /> Bank
                  </button>
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm text-slate-400">Keterangan / Deskripsi</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Gaji bulanan, makan, listrik..."
                  className="w-full p-4 bg-slate-900/60 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/30 transition-all font-sans"
                  required
                />
              </div>

              <div>
                <label className="block mb-2 text-sm text-slate-400">Jumlah (Rp)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min="1"
                  className="w-full p-4 bg-slate-900/60 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/30 transition-all font-sans"
                  required
                />
              </div>

              <button type="submit" className="mt-2 w-full p-4 bg-gradient-to-r from-primary to-purple-600 hover:to-purple-500 rounded-xl font-bold text-lg flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] transition-all hover:-translate-y-1">
                Simpan Keuangan <FaPaperPlane />
              </button>
            </form>
          </div>

          {/* Charts Area */}
          <div className="flex flex-col gap-6">
            {/* Global Chart */}
            <div className="glass-panel p-8 rounded-2xl flex flex-col flex-1">
              <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                <h2 className="text-2xl font-semibold flex items-center gap-2"><FaChartPie className="text-primary text-xl" /> Akumulasi Keseluruhan</h2>
              </div>
              <div className="flex-1 flex items-center justify-center relative min-h-[250px]">
                {globalIncome === 0 && globalExpense === 0 ? (
                  <div className="flex flex-col items-center justify-center text-slate-500 gap-4">
                    <FaChartSimple className="text-6xl opacity-50" />
                    <p>Belum ada data visual</p>
                  </div>
                ) : (
                  <div className="w-full h-full relative" style={{ height: '250px' }}>
                    <Doughnut data={globalChartData} options={{ maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom', labels: { padding: 25, usePointStyle: true } } } }} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-[50px]">
                      <span className="text-sm text-slate-400">Total Akumulasi</span>
                      <span className="text-lg font-bold">{formatIDR(globalIncome + globalExpense)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Monthly Chart */}
            <div className="glass-panel p-8 rounded-2xl flex flex-col flex-1">
              <div className="flex flex-col xl:flex-row justify-between xl:items-center items-start gap-4 mb-6 border-b border-white/10 pb-4">
                <h2 className="text-2xl font-semibold flex items-center gap-2"><FaChartPie className="text-blue-400 text-xl" /> Bulan Ini</h2>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
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
                  <div className="w-full h-full relative" style={{ height: '250px' }}>
                    <Bar
                      data={monthlyChartData}
                      options={{
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                          x: { grid: { display: false } }
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* History List */}
        <section className="glass-panel p-8 rounded-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 border-b border-white/10 pb-4 gap-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <FaRectangleList className="text-primary text-xl" /> Riwayat Transaksi Utuh
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-slate-900/60 rounded-lg p-1 border border-white/10">
                <button
                  onClick={() => setTxFilter('all')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium ${txFilter === 'all' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setTxFilter('income')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium ${txFilter === 'income' ? 'bg-income text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  Pemasukan
                </button>
                <button
                  onClick={() => setTxFilter('expense')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium ${txFilter === 'expense' ? 'bg-expense text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  Pengeluaran
                </button>
              </div>

              <select
                value={txLimit}
                onChange={(e) => setTxLimit(Number(e.target.value))}
                className="bg-slate-900/80 border border-white/10 rounded-lg py-1.5 px-3 text-sm text-slate-300 focus:outline-none focus:border-primary cursor-pointer hover:border-white/20 transition-colors"
                title="Tampilkan jumlah data"
              >
                <option value={10}>10 Data</option>
                <option value={25}>25 Data</option>
                <option value={50}>50 Data</option>
                <option value={100}>100 Data</option>
              </select>

              {transactions.length > 0 && (
                <button onClick={clearAll} className="text-sm bg-slate-900/60 border border-white/10 px-4 py-1.5 rounded-lg hover:border-expense hover:text-expense hover:bg-expense/10 transition-all font-medium" title="Hapus Semua Baris">
                  Hapus Semua
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {displayedTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-4 py-12">
                <FaRegFolderOpen className="text-6xl opacity-50" />
                <p>{transactions.length === 0 ? "Belum ada riwayat transaksi" : "Tidak ada transaksi untuk filter ini"}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {displayedTransactions.map(tx => (
                  <li key={tx.id} className={`p-5 rounded-xl bg-slate-900/40 border border-white/5 hover:bg-slate-800/80 transition-all flex justify-between items-center border-l-4 group
                    ${tx.type === 'income' ? 'border-l-income' : 'border-l-expense'}
                  `}>
                    <div>
                      <h4 className="font-medium text-lg mb-1 flex items-center gap-2">
                        {tx.text}
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${tx.source === 'bank' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'}`}>
                          {tx.source === 'bank' ? 'BANK' : 'CASH'}
                        </span>
                      </h4>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <FaCalendar /> {new Date(tx.createdAt || tx.id).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short', hour12: false })} WIB
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className={`font-bold text-xl ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                        {tx.type === 'income' ? '+' : '-'} {formatIDR(tx.amount)}
                      </span>
                      <button onClick={() => deleteTransaction(tx.id)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 bg-transparent hover:bg-expense/10 hover:text-expense transition-colors" title="Hapus">
                        <FaTrashCan />
                      </button>
                    </div>
                  </li>
                ))}

                {filteredHistoryList.length > txLimit && (
                  <li className="text-center pt-4 pb-2">
                    <p className="text-sm text-slate-400">
                      Menampilkan {txLimit} dari {filteredHistoryList.length} data. Ubah batas tampilan di atas untuk melihat lebih banyak.
                    </p>
                  </li>
                )}
              </ul>
            )}
          </div>
        </section>

        {/* Activities Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <div className="glass-panel p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2"><FaClock className="text-blue-400 text-xl" /> Tambah Jadwal & Pengingat</h2>
            </div>
            <form onSubmit={handleAddActivity} className="flex flex-col gap-5">
              <div>
                <label className="block mb-2 text-sm text-slate-400">Nama Kegiatan</label>
                <input
                  type="text"
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  placeholder="Contoh: Bayar Tagihan Listrik"
                  className="w-full p-4 bg-slate-900/60 border border-white/10 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/30 transition-all font-sans"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 text-sm text-slate-400">Waktu Pelaksanaan</label>
                <DatePicker
                  selected={actTime}
                  onChange={(date) => setActTime(date)}
                  showTimeInput
                  timeInputLabel="Waktu:"
                  dateFormat="d MMMM yyyy, HH:mm"
                  locale="id"
                  className="w-full p-4 bg-slate-900/60 border border-white/10 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/30 transition-all font-sans"
                  wrapperClassName="w-full"
                  required
                />
              </div>
              <button type="submit" className="mt-2 w-full p-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:to-cyan-400 rounded-xl font-bold text-lg flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:-translate-y-1">
                Simpan Jadwal
              </button>
            </form>
          </div>

          <div className="glass-panel p-8 rounded-2xl flex flex-col">
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2"><FaListCheck className="text-blue-400 text-xl" /> Daftar Kegiatan</h2>
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
                    <li key={act.id} className={`p-4 rounded-xl border transition-all flex justify-between items-center group
                      ${act.completed ? 'bg-slate-900/30 border-white/5 opacity-60' : 'bg-slate-800/80 border-blue-400/30 hover:border-blue-400/60'}
                    `}>
                      <div>
                        <h4 className={`font-medium text-lg mb-1 ${act.completed ? 'line-through text-slate-400' : 'text-white'}`}>{act.title}</h4>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <FaClock /> {new Date(act.time).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short', hour12: false })} WIB
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xl">
                        {act.completed && <FaCheck className="text-income mr-2" title="Selesai" />}
                        <button onClick={() => deleteActivity(act.id)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-expense/10 hover:text-expense transition-colors" title="Hapus">
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

      <footer className="text-center py-6 text-slate-500 text-sm">
        <p>&copy; {new Date().getFullYear()} Finance Muss. Built with Next.js & Tailwind CSS.</p>
      </footer>
    </div>
  );
}
