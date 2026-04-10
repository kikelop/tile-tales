"use client";

import dynamic from "next/dynamic";

const TileViewer3D = dynamic(() => import("@/components/TileViewer3D"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-screen w-full items-center justify-center"
      style={{ background: "#f5f2ed" }}
    >
      <p style={{ color: "#8a8578" }}>Loading 3D viewer...</p>
    </div>
  ),
});

export default function ViewerPage() {
  return <TileViewer3D />;
}
