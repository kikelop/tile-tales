import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Tile Tales",
  description: "How Tile Tales handles your data (spoiler: it stays on your device).",
};

const bg = "#f5f2ed";
const fg = "#1a1a1a";
const muted = "#8a8578";
const accent = "#3586f2";

export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: bg,
        color: fg,
        padding: "64px 20px 96px",
        fontFamily:
          "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif",
        lineHeight: 1.6,
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          Privacy Policy — Tile Tales
        </h1>
        <p style={{ color: muted, fontSize: 14, marginTop: 8 }}>Last updated: 30 May 2026</p>

        <h2 style={sectionStyle}>The short version</h2>
        <p>
          Tile Tales does not collect, transmit, or store any of your personal data on
          any server. Everything you create stays on your device. There are no accounts,
          no analytics, no advertising, and no third-party tracking.
        </p>

        <h2 style={sectionStyle}>What the app accesses, and why</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}>
            <strong>Camera</strong> — to photograph tiles you want to add to your
            collection. Photos are saved only inside the app on your device.
          </li>
          <li style={liStyle}>
            <strong>Photo Library (read)</strong> — to let you import existing photos as
            tiles. The app reads the photos you choose, including their embedded location
            (EXIF GPS), so it can place a tile on the map. It does not browse or upload
            your library.
          </li>
          <li style={liStyle}>
            <strong>Photo Library (add)</strong> — to save wallpapers you generate back to
            your photos, only when you tap “Download”.
          </li>
          <li style={liStyle}>
            <strong>Location (when in use)</strong> — to record where you found a tile when
            you capture it with the camera. The coordinate is stored with that tile on your
            device.
          </li>
        </ul>
        <p>All of the above is processed locally. None of it is sent anywhere.</p>

        <h2 style={sectionStyle}>Where your data lives</h2>
        <p>
          Your tiles, albums, wallpapers and their images are stored on your device. If you
          use the Export feature, a backup file is created that you choose where to send or
          save — the app does not upload it anywhere on its own.
        </p>

        <h2 style={sectionStyle}>Third parties</h2>
        <p>
          Tile Tales uses Apple’s on-device frameworks only (MapKit for the map, CLGeocoder
          to turn coordinates into place names). Reverse geocoding requests go to Apple as
          part of normal MapKit/CoreLocation use and are governed by Apple’s privacy policy.
          The app adds no SDKs for analytics, ads, or tracking.
        </p>

        <h2 style={sectionStyle}>Children</h2>
        <p>
          The app is suitable for all ages and collects no data, so there is nothing to
          restrict for children.
        </p>

        <h2 style={sectionStyle}>Changes</h2>
        <p>
          If this policy changes, the updated version will be posted at the same URL with a
          new “Last updated” date.
        </p>

        <h2 style={sectionStyle}>Contact</h2>
        <p>
          Questions:{" "}
          <a href="mailto:elopez@elconfidencial.com" style={{ color: accent }}>
            elopez@elconfidencial.com
          </a>
        </p>
      </div>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  marginTop: 36,
  marginBottom: 8,
};

const liStyle: React.CSSProperties = { marginBottom: 12 };
