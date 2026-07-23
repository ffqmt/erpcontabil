import { NextRequest, NextResponse } from 'next/server'
import { getMunicipalities } from '@/modules/registrations/locations/queries'

export async function GET(request: NextRequest) {
  const uf = request.nextUrl.searchParams.get('uf') || undefined

  try {
    const municipalities = await getMunicipalities(uf)
    return NextResponse.json({ municipalities })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Falha ao buscar municípios.' }, { status: 500 })
  }
}
