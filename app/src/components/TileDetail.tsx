"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type Tile } from "@/lib/mock-tiles";

interface TileDetailProps {
  tile: Tile | null;
  onClose: () => void;
}

export default function TileDetail({ tile, onClose }: TileDetailProps) {
  return (
    <AnimatePresence>
      {tile && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
              {/* Image */}
              <div className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.image}
                  alt={tile.title}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="p-6">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {tile.title}
                </h2>
                <p className="mt-1" style={{ color: "#8a8578" }}>
                  {tile.location}
                </p>
                <p className="mt-0.5 text-sm" style={{ color: "#8a8578" }}>
                  {tile.date}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {tile.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-3 py-1 text-sm font-medium"
                      style={{
                        backgroundColor: `${tile.color}15`,
                        color: tile.color,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <button
                  onClick={onClose}
                  className="mt-6 w-full rounded-full border border-black/10 py-2.5 text-sm font-medium tracking-wide uppercase transition-colors hover:bg-black/5"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
