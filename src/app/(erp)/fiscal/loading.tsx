import React from 'react'

export default function FiscalLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-12 w-full max-w-md rounded bg-gray-100" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="h-24 rounded-lg bg-gray-100" />
        <div className="h-24 rounded-lg bg-gray-100" />
        <div className="h-24 rounded-lg bg-gray-100" />
      </div>
      <div className="space-y-3">
        <div className="h-20 rounded-lg bg-gray-100" />
        <div className="h-20 rounded-lg bg-gray-100" />
        <div className="h-20 rounded-lg bg-gray-100" />
      </div>
    </div>
  )
}
