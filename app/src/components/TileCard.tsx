"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { type Tile } from "@/lib/mock-tiles";

interface TileCardProps {
  tile: Tile;
  index: number;
  onSelect: (tile: Tile) => void;
}

export default function TileCard({ tile, index, onSelect }: TileCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-12deg", "12deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(px);
    y.set(py);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect(tile)}
      className="group relative cursor-pointer"
    >
      <div
        className="relative overflow-hidden rounded-2xl bg-white shadow-lg transition-shadow duration-300 group-hover:shadow-2xl"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Image */}
        <div
          className="relative aspect-square overflow-hidden"
          style={{ backgroundColor: tile.color + "20" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tile.image}
            alt={tile.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Gloss overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 50%, rgba(0,0,0,0.05) 100%)",
            }}
          />
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-base font-semibold tracking-tight">{tile.title}</h3>
          <p className="mt-1 text-sm" style={{ color: "#8a8578" }}>
            {tile.location}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tile.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${tile.color}15`,
                  color: tile.color,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
