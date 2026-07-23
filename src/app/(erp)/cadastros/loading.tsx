import React from 'react'

export default function CadastrosLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-12 w-full max-w-md rounded bg-gray-100" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="h-24 rounded-lg bg-gray-100" />
        <div className="h-24 rounded-lg bg-gray-100" />
        <div className="h-24 rounded-lg bg-gray-100" />
        <div className="h-24 rounded-lg bg-gray-100" />
      </div>
      <div className="h-72 rounded-lg bg-gray-100" />
    </div>
  )
}
