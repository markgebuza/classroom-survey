import { useEffect, type ReactNode } from 'react'

/** No header or navigation: used by the student page and the projector (Present) page. */
export default function MinimalLayout({
  pageTitle,
  wide = false,
  children,
}: {
  pageTitle: string
  wide?: boolean
  children: ReactNode
}) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} – Classroom Survey` : 'Classroom Survey'
  }, [pageTitle])

  return (
    <main
      className={
        wide
          ? 'flex min-h-screen flex-col items-center bg-white px-4 py-6 text-center text-slate-950'
          : 'mx-auto min-h-screen max-w-xl px-4 py-8 text-slate-950'
      }
    >
      {children}
    </main>
  )
}
