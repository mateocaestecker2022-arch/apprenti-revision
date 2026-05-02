'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    setDark(stored === 'dark')
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      title={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      className="text-xs border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition text-gray-500 dark:text-gray-400"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}
