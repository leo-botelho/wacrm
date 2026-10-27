import type { ReactNode } from 'react'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 text-slate-200">
      <article className="space-y-4 text-sm leading-relaxed [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </article>
    </main>
  )
}
