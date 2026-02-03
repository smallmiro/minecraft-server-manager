import { useState, useEffect, useRef } from "react";

const consoleLines = [
  { time: "15:25:49", thread: "main", level: "INFO", msg: "Loaded 15 recipes" },
  { time: "15:25:50", thread: "main", level: "INFO", msg: "Loaded 4037 advancements" },
  { time: "15:25:50", thread: "main", level: "INFO", msg: "Loading exposure lenses:" },
  { time: "15:25:50", thread: "main", level: "INFO", msg: "Lens [exposure:spyglass, FocalRange[min=55, max=200]] added." },
  { time: "15:25:50", thread: "main", level: "INFO", msg: "Loaded 8 fish conversions" },
  { time: "15:25:50", thread: "main", level: "WARN", msg: "naturalist:reptile_hide is not a valid item identifier at resource fleshz:rack_items/reptile_hide.json" },
  { time: "15:25:50", thread: "main", level: "INFO", msg: "[Fabric Seasons] Successfully loaded 63 custom crop configs." },
  { time: "15:25:50", thread: "main", level: "INFO", msg: "Loaded 144 recipes" },
  { time: "15:25:51", thread: "main", level: "INFO", msg: "Initialized TerraBlender biomes for level stem minecraft:the_nether" },
  { time: "15:25:51", thread: "main", level: "INFO", msg: "Initialized TerraBlender biomes for level stem minecraft:overworld" },
  { time: "15:25:51", thread: "main", level: "INFO", msg: "Applied 1488 biome modifications to 120 of 129 new biomes in 23.34 ms" },
  { time: "15:25:51", thread: "Server thread", level: "WARN", msg: "Configuration file ./config/dungeonnowloading-server.toml is not correct. Correcting" },
  { time: "15:25:51", thread: "Server thread", level: "INFO", msg: "Async locator -> Starting locating executor service with thread pool size of 1" },
];

function CpuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
    </svg>
  );
}

function MemoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 6V4M10 6V4M14 6V4M18 6V4M6 18v2M10 18v2M14 18v2M18 18v2" />
      <rect x="6" y="10" width="4" height="4" rx="0.5" />
      <rect x="14" y="10" width="4" height="4" rx="0.5" />
    </svg>
  );
}

function StorageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 002-2V8a2 2 0 00-2-2h-7.93a2 2 0 01-1.66-.9l-.82-1.2A2 2 0 007.93 3H4a2 2 0 00-2 2v13a2 2 0 002 2z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0115.36-6.36L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 01-15.36 6.36L3 16" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 9l4 3-4 3" />
    </svg>
  );
}

function ProgressBar({ value, max = 100, color = "#1bd96a" }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{
      width: "100%",
      height: 6,
      backgroundColor: "#2a2d3a",
      borderRadius: 3,
      overflow: "hidden",
      marginTop: 8,
    }}>
      <div style={{
        width: `${pct}%`,
        height: "100%",
        background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
        borderRadius: 3,
        transition: "width 0.6s ease",
      }} />
    </div>
  );
}

function StatCard({ value, unit, label, icon, progress, progressMax, color }) {
  return (
    <div style={{
      flex: 1,
      backgroundColor: "#1e2030",
      borderRadius: 12,
      padding: "20px 24px",
      border: "1px solid #2a2d3e",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      minWidth: 0,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#e8e8ef", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: "-0.5px" }}>
            {value}
          </span>
          <span style={{ fontSize: 14, color: "#6b6e80", fontWeight: 500 }}>
            {unit}
          </span>
        </div>
        <div style={{ color: "#6b6e80", marginTop: 4 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 13, color: "#6b6e80", fontWeight: 500, marginTop: 2 }}>{label}</div>
      <ProgressBar value={progress} max={progressMax} color={color || "#1bd96a"} />
    </div>
  );
}

export default function MinecraftServerPanel() {
  const [command, setCommand] = useState("");
  const consoleRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const tabs = ["Overview", "Content", "Files", "Backups", "Options"];
  const [activeTab, setActiveTab] = useState("Overview");

  useEffect(() => {
    if (consoleRef.current && isAtBottom) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [isAtBottom]);

  const handleScroll = () => {
    if (!consoleRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = consoleRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 30);
  };

  const scrollToBottom = () => {
    if (consoleRef.current) {
      consoleRef.current.scrollTo({ top: consoleRef.current.scrollHeight, behavior: "smooth" });
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#13141c",
      color: "#e0e0e8",
      fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "24px 32px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        {/* Server Icon */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#1e2030",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "1px solid #2a2d3e",
        }}>
          <div style={{ fontSize: 36 }}>🌳</div>
        </div>

        {/* Server Info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "#1bd96a", cursor: "pointer", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <span>←</span> All servers
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#f0f0f6", letterSpacing: "-0.3px" }}>
            Pyro SMP
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 6, flexWrap: "wrap", fontSize: 13, color: "#6b6e80" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6e80" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
              Minecraft 1.20.1
            </span>
            <span style={{ margin: "0 10px", color: "#3a3d4e" }}>|</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6e80" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              Fabric 0.16.7
            </span>
            <span style={{ margin: "0 10px", color: "#3a3d4e" }}>|</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6e80" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              pyro-smp.modrinth.gg
            </span>
            <span style={{ margin: "0 10px", color: "#3a3d4e" }}>|</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6e80" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              1m 12s
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            backgroundColor: "transparent", border: "1px solid #2a2d3e",
            color: "#c0c0cc", cursor: "pointer", fontSize: 14, fontWeight: 500,
          }}>
            <StopIcon /> Stop
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            backgroundColor: "#1bd96a", border: "none",
            color: "#0a0e14", cursor: "pointer", fontSize: 14, fontWeight: 600,
          }}>
            <RestartIcon /> Restart
          </button>
          <button style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 36, height: 36, borderRadius: 8,
            backgroundColor: "transparent", border: "1px solid #2a2d3e",
            color: "#c0c0cc", cursor: "pointer", fontSize: 18,
          }}>
            ⋮
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: "none",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              backgroundColor: activeTab === tab ? "#1bd96a" : "transparent",
              color: activeTab === tab ? "#0a0e14" : "#8b8da0",
              transition: "all 0.2s ease",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <StatCard
          value="0.22%"
          unit="/ 100%"
          label="CPU usage"
          icon={<CpuIcon />}
          progress={0.22}
          progressMax={100}
          color="#1bd96a"
        />
        <StatCard
          value="39.58%"
          unit="/ 100%"
          label="Memory usage"
          icon={<MemoryIcon />}
          progress={39.58}
          progressMax={100}
          color="#1bd96a"
        />
        <StatCard
          value="394.52 MB"
          unit="/ 15 GB"
          label="Storage usage"
          icon={<StorageIcon />}
          progress={394.52}
          progressMax={15360}
          color="#1bd96a"
        />
      </div>

      {/* Console */}
      <div style={{
        backgroundColor: "#1e2030",
        borderRadius: 12,
        border: "1px solid #2a2d3e",
        overflow: "hidden",
      }}>
        {/* Console Header */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid #2a2d3e",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#f0f0f6" }}>Console</h2>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            backgroundColor: "#1bd96a",
            boxShadow: "0 0 8px #1bd96a66",
          }} />
        </div>

        {/* Console Body */}
        <div style={{ position: "relative" }}>
          <div
            ref={consoleRef}
            onScroll={handleScroll}
            style={{
              height: 360,
              overflowY: "auto",
              padding: "16px 20px",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
              fontSize: 13,
              lineHeight: 1.85,
              color: "#b4b6c4",
              scrollbarWidth: "thin",
              scrollbarColor: "#3a3d4e #1e2030",
            }}
          >
            {consoleLines.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span style={{ color: "#4a4d60" }}>[{line.time}]</span>
                <span style={{ color: "#4a4d60" }}>&nbsp;[{line.thread}/{line.level === "WARN" ? <span style={{ color: "#e8a848" }}>{line.level}</span> : <span style={{ color: "#6b6e80" }}>{line.level}</span>}]:&nbsp;</span>
                <span style={{ color: line.level === "WARN" ? "#c4a45a" : "#b4b6c4" }}>{line.msg}</span>
              </div>
            ))}
          </div>

          {/* Expand button */}
          <button style={{
            position: "absolute", top: 12, right: 12,
            width: 36, height: 36, borderRadius: 8,
            backgroundColor: "#282a3a", border: "1px solid #3a3d4e",
            color: "#8b8da0", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ExpandIcon />
          </button>

          {/* Scroll to bottom */}
          {!isAtBottom && (
            <button
              onClick={scrollToBottom}
              style={{
                position: "absolute", bottom: 12, right: 12,
                width: 36, height: 36, borderRadius: 8,
                backgroundColor: "#282a3a", border: "1px solid #3a3d4e",
                color: "#8b8da0", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ArrowDownIcon />
            </button>
          )}
        </div>

        {/* Command Input */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid #2a2d3e",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#13141c",
            borderRadius: 8,
            padding: "10px 14px",
            border: "1px solid #2a2d3e",
          }}>
            <TerminalIcon />
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Send a command"
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "#b4b6c4",
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
