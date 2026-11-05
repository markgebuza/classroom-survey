export default function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div role="status" aria-live="polite" className="p-8 text-center text-lg text-slate-700">
      {message}
    </div>
  )
}
