import { NextRequest, NextResponse } from 'next/server';

import { keiyouMangaClient, KeiyouMangaClient } from '@/lib/keiyou-manga.client';

import { getAuthorizedUsername } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const sourceId = searchParams.get('sourceId')?.trim() || undefined;
    const repoUrl = searchParams.get('repo') ||
      'https://gh-proxy.com/https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json';

    if (!q) {
      return NextResponse.json({ results: [] });
    }

    const client = new KeiyouMangaClient(repoUrl);
    const results = await client.searchManga(q, sourceId);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}