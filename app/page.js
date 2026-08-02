"use client";

import mqtt from "mqtt";
import { useEffect, useRef, useState } from "react";

const GROUP = process.env.NEXT_PUBLIC_GROUP_NAME;
const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID;

const TOPICS = {
  telemetry: `${GROUP}/esp32/${DEVICE_ID}/telemetry`,
  status: `${GROUP}/esp32/${DEVICE_ID}/status`,
  state1: `${GROUP}/esp32/${DEVICE_ID}/state/relay1`,
  state2: `${GROUP}/esp32/${DEVICE_ID}/state/relay2`,
  cmd1: `${GROUP}/esp32/${DEVICE_ID}/commands/relay1`,
  cmd2: `${GROUP}/esp32/${DEVICE_ID}/commands/relay2`,
};

export default function Home() {
  const clientRef = useRef(null);
  const [status, setStatus] = useState("offline");
  const [telemetry, setTelemetry] = useState(null);
  const [relay1, setRelay1] = useState("off");
  const [relay2, setRelay2] = useState("off");
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const client = mqtt.connect(process.env.NEXT_PUBLIC_BROKER_URL, {
      username: process.env.NEXT_PUBLIC_BROKER_USER,
      password: process.env.NEXT_PUBLIC_BROKER_PASS,
    });
    clientRef.current = client;

    client.on("connect", () => {
      client.subscribe([
        TOPICS.telemetry,
        TOPICS.status,
        TOPICS.state1,
        TOPICS.state2,
      ]);
    });

    client.on("message", (topic, payload) => {
      try {
        if (topic === TOPICS.telemetry) {
          setTelemetry(JSON.parse(payload.toString()));
        } else if (topic === TOPICS.status) {
          setStatus(payload.toString());
        } else if (topic === TOPICS.state1) {
          setRelay1(payload.toString());
        } else if (topic === TOPICS.state2) {
          setRelay2(payload.toString());
        }
        setLastUpdate(Date.now());
      } catch (err) {
        console.error("bad payload on", topic, err.message);
      }
    });

    client.on("error", (err) => console.error("mqtt error", err));

    return () => client.end();
  }, []);

  const online = status === "online";

  function setRelay(which, on) {
    if (!online || !clientRef.current) return;
    const topic = which === 1 ? TOPICS.cmd1 : TOPICS.cmd2;
    clientRef.current.publish(topic, on ? "on" : "off");
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <header style={styles.header}>
          <h1 style={styles.title}>Next.js IoT dashboard</h1>
          <StatusPill online={online} />
        </header>

        {!online && (
          <div style={styles.banner}>
            Device offline
            {lastUpdate ? ` — last seen at ${formatTime(lastUpdate)}` : ""}
          </div>
        )}

        <Section title={`Relay controls${online ? "" : " — disabled"}`}>
          <div style={styles.relayGrid}>
            <RelayCard
              label="Relay 1"
              state={relay1}
              online={online}
              onToggle={(v) => setRelay(1, v)}
            />
            <RelayCard
              label="Relay 2"
              state={relay2}
              online={online}
              onToggle={(v) => setRelay(2, v)}
            />
          </div>
        </Section>

        <Section title={`BMP180 sensor${online ? "" : " — greyed out"}`}>
          <div style={{ ...styles.sensorRow, opacity: online ? 1 : 0.4 }}>
            <Reading
              label="Temperature"
              value={telemetry ? `${telemetry.temperature}°C` : "—"}
            />
            <Reading
              label="Humidity"
              value={telemetry ? `${telemetry.humidity} m` : "—"}
            />
          </div>
        </Section>

        <footer style={styles.footer}>
          Last update: <SecondsAgo timestamp={lastUpdate} />
        </footer>
      </div>
    </main>
  );
}

function StatusPill({ online }) {
  return (
    <span
      style={{
        ...styles.pill,
        background: online ? "#e6f5ea" : "#f2f2f2",
        color: online ? "#1e7a37" : "#888",
      }}
    >
      <span
        style={{ ...styles.dot, background: online ? "#2e9e5b" : "#999" }}
      />
      {online ? "Online" : "Offline"}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </section>
  );
}

function RelayCard({ label, state, online, onToggle }) {
  const isOn = state === "on";
  return (
    <div style={styles.relayCard}>
      <div style={styles.relayLabel}>{label}</div>
      <button
        disabled={!online}
        onClick={() => onToggle(!isOn)}
        style={{
          ...styles.relayButton,
          background: !online ? "#eee" : isOn ? "#2e9e5b" : "#fff",
          color: !online ? "#aaa" : isOn ? "#fff" : "#333",
          cursor: online ? "pointer" : "not-allowed",
        }}
      >
        {!online ? "Disabled" : isOn ? "On" : "Off"}
      </button>
      <div style={styles.relayState}>
        {online ? (isOn ? "on" : "off") : "--"}
      </div>
    </div>
  );
}

function Reading({ label, value }) {
  return (
    <div style={styles.reading}>
      <div style={styles.readingLabel}>{label}</div>
      <div style={styles.readingValue}>{value}</div>
    </div>
  );
}

function SecondsAgo({ timestamp }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!timestamp) return <span>--</span>;
  const secs = Math.floor((now - timestamp) / 1000);
  return <span>{secs} seconds ago</span>;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f7f5",
    padding: "32px 16px",
    fontFamily: "sans-serif",
  },
  card: {
    maxWidth: 520,
    margin: "0 auto",
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 12,
    padding: 24,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    color: "#000"
  },
  title: { fontSize: 18, fontWeight: 500, margin: 0 },
  pill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    padding: "4px 10px",
    borderRadius: 999,
  },
  dot: { width: 7, height: 7, borderRadius: "50%" },
  banner: {
    background: "#fff4e5",
    color: "#8a5a00",
    border: "1px solid #f3d9a8",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 20,
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#985",
    marginBottom: 10,
  },
  relayGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  relayCard: {
    border: "1px solid #eee",
    borderRadius: 10,
    padding: 14,
    textAlign: "center",
  },
  relayLabel: { fontSize: 14, fontWeight: 500, marginBottom: 10, color: "#980" },
  relayButton: {
    width: "100%",
    padding: "8px 0",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 13,
    marginBottom: 8,
    color: "#111"
  },
  relayState: { fontSize: 12, color: "#111", color:"#111" },
  sensorRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  reading: {
    background: "#f5f5f5",
    borderRadius: 8,
    padding: "10px 12px",
    textAlign: "center",
    color: "#111"
  },
  readingLabel: { fontSize: 14, color: "#111", marginBottom: 4 },
  readingValue: { fontSize: 16, fontWeight: 500 },
  footer: {
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
    borderTop: "1px solid #f0f0f0",
    paddingTop: 14,
  },
};