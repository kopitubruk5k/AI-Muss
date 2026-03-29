"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FaRobot, FaPaperPlane, FaTrashCan, FaArrowLeft,
  FaToggleOn, FaToggleOff, FaWallet, FaSpinner
} from "react-icons/fa6";

function MarkdownText({ text }) {
  // Simple markdown-like rendering: bold, inline code, line breaks, lists
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, i) => {
        // Unordered list item
        if (/^[-*•]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>{renderInline(line.replace(/^[-*•]\s/, ""))}</span>
            </div>
          );
        }
        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^(\d+)\./)[1];
          return (
            <div key={i} className="flex gap-2">
              <span className="text-primary shrink-0">{num}.</span>
              <span>{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
            </div>
          );
        }
        // Heading
        if (/^#{1,3}\s/.test(line)) {
          return <p key={i} className="font-bold text-white mt-1">{renderInline(line.replace(/^#+\s/, ""))}</p>;
        }
        // Empty line
        if (!line.trim()) return <div key={i} className="h-1" />;
        // Normal line
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (/^`[^`]+`$/.test(part)) {
      return <code key={i} className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-primary">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export default function AiPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Halo! Saya **FinanceMU Assistant** 👋\n\nSaya bisa membantu kamu dengan berbagai pertanyaan — mulai dari keuangan, kehidupan sehari-hari, hingga pengetahuan umum.\n\nAktifkan **Data Keuangan** di kanan atas jika ingin saya menganalisis transaksi kamu. Ada yang bisa saya bantu?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [includeFinance, setIncludeFinance] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    textareaRef.current?.focus();

    try {
      // Build history excluding the first welcome message and the current user message
      const history = newMessages.slice(1, -1).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, includeFinance }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ **Error:** ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: "Chat direset. Ada yang bisa saya bantu? 😊"
    }]);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 flex flex-col h-screen max-h-screen gap-4">
      {/* Header */}
      <header className="glass-panel rounded-2xl px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            title="Kembali ke Dashboard"
          >
            <FaArrowLeft />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary text-xl">
              <FaRobot />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg leading-tight">FinanceMU Assistant</h1>
              <p className="text-xs text-slate-400">Powered by Gemini 2.0 Flash</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Finance toggle */}
          <button
            onClick={() => setIncludeFinance((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
              includeFinance
                ? "bg-primary/20 border-primary text-primary"
                : "bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20"
            }`}
            title={includeFinance ? "Data keuangan aktif" : "Aktifkan data keuangan"}
          >
            <FaWallet className="text-xs" />
            <span className="hidden sm:inline">Data Keuangan</span>
            {includeFinance ? <FaToggleOn className="text-lg" /> : <FaToggleOff className="text-lg" />}
          </button>

          {/* Clear chat */}
          <button
            onClick={clearChat}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-expense hover:bg-expense/10 transition-all"
            title="Hapus percakapan"
          >
            <FaTrashCan />
          </button>
        </div>
      </header>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 pr-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            {/* Avatar */}
            <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold
              ${msg.role === "user"
                ? "bg-primary text-white"
                : "bg-slate-700 text-primary"
              }`}
            >
              {msg.role === "user" ? "U" : <FaRobot />}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed
                ${msg.role === "user"
                  ? "bg-primary text-white rounded-tr-sm"
                  : "glass-panel text-slate-200 rounded-tl-sm"
                }`}
            >
              {msg.role === "user" ? (
                <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
              ) : (
                <MarkdownText text={msg.content} />
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-3 flex-row">
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-sm bg-slate-700 text-primary">
              <FaRobot />
            </div>
            <div className="glass-panel rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Finance context badge */}
      {includeFinance && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-xl text-xs text-primary shrink-0">
          <FaWallet />
          <span>Mode data keuangan aktif — AI dapat membaca transaksi kamu</span>
        </div>
      )}

      {/* Input area */}
      <div className="glass-panel rounded-2xl p-3 flex items-end gap-3 shrink-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ketik pertanyaan... (Enter untuk kirim, Shift+Enter untuk baris baru)"
          rows={1}
          className="flex-1 bg-transparent resize-none text-sm text-white placeholder-slate-500 focus:outline-none leading-relaxed max-h-40 overflow-y-auto py-1.5 custom-scrollbar"
          style={{ minHeight: "36px" }}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
          }}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-xl bg-primary hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shrink-0"
        >
          {loading ? <FaSpinner className="animate-spin text-sm" /> : <FaPaperPlane className="text-sm" />}
        </button>
      </div>
    </div>
  );
}
