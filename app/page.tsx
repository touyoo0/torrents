"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import GifBackground from "./components/GifBackground";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-12 relative"
      >
        <motion.div 
          className="absolute -inset-20 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: [0, 0.2, 0.1, 0.2, 0],
            scale: [0.8, 1.2, 1, 1.2, 0.8],
            rotate: [0, 90, 180, 270, 360]
          }}
          transition={{ 
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut" 
          }}
        />
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 font-display relative">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            T
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            o
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            r
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            r
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            e
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            n
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            t
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
          >
            s
          </motion.span>
        </h1>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          whileHover={{ scale: 1.03 }}
          className="w-full"
        >
          <Link href="/movies" className="block w-full">
            <div className="bg-gradient-to-br from-blue-600 to-blue-900 hover:from-blue-500 hover:to-blue-800 text-white rounded-xl p-8 h-48 flex flex-col items-center justify-center shadow-lg transition-all duration-300 border border-blue-700 hover:border-blue-500 hover:shadow-blue-900/20 hover:shadow-xl relative overflow-hidden">
              <GifBackground type="movies" />
              <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-2">Films</h2>
              </div>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          whileHover={{ scale: 1.03 }}
          className="w-full"
        >
          <Link href="/series" className="block w-full">
            <div className="bg-gradient-to-br from-purple-600 to-purple-900 hover:from-purple-500 hover:to-purple-800 text-white rounded-xl p-8 h-48 flex flex-col items-center justify-center shadow-lg transition-all duration-300 border border-purple-700 hover:border-purple-500 hover:shadow-purple-900/20 hover:shadow-xl relative overflow-hidden">
              <GifBackground type="series" />
              <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-2">Séries</h2>
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
