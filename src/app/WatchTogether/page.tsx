"use client"

import React from 'react'
import Title from '@/components/Title'

export default function WatchTogetherPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-6">
      <div className="max-w-4xl w-full text-center space-y-6">
        <div className="inline-block p-4 rounded-full bg-yellow-300/20 dark:bg-yellow-400/10">
          {/* Simple caution SVG */}
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 21h22L12 2 1 21z" fill="#FACC15"/>
            <path d="M12 9v4" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="17" r="1" fill="#111827"/>
          </svg>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-zinc-900 dark:text-zinc-100">Work In Progress</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-300">Soon available — nous préparons une fonctionnalité collaborative pour regarder des animés ensemble.</p>

        <div className="mx-auto max-w-xl">
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-800">
            <div className="text-xl font-semibold mb-2">Stay tuned</div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Nous travaillons activement sur cette page. Revenez bientôt pour la version finale.</p>

            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {/* decorative construction tapes */}
              <span className="px-3 py-1 rounded-full bg-yellow-400 text-zinc-900 font-medium">Under Construction</span>
              <span className="px-3 py-1 rounded-full bg-yellow-400 text-zinc-900 font-medium">Bientôt</span>
            </div>
          </div>
        </div>

        <div className="pt-6 text-xs text-zinc-500">Vous pouvez toujours utiliser les autres sections du site (listes, profil, etc.)</div>
      </div>
    </div>
  )
}
