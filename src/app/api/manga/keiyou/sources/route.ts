import { NextRequest, NextResponse } from 'next/server';

import { keiyouMangaClient } from '@/lib/keiyou-manga.client';

import { getAuthorizedUsername } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const repoUrl = new URL(request.url).searchParams.get('repo') ||
      'https://gh-proxy.com/https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json';

    const client = new keiyouMangaClient(repoUrl);
    const sources = await client.getSources();
    return NextResponse.json({ sources });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}