import { NextRequest, NextResponse } from 'next/server';

import { KeiyouMangaClient } from '@/lib/keiyou-manga.client';

import { getAuthorizedUsername } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const chapterId = searchParams.get('chapterId')?.trim();
    const sourceId = searchParams.get('sourceId')?.trim();
    const repoUrl = searchParams.get('repo') ||
      'https://gh-proxy.com/https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json';

    if (!chapterId || !sourceId) {
      return NextResponse.json({ error: '缺少 chapterId 或 sourceId' }, { status: 400 });
    }

    const client = new KeiyouMangaClient(repoUrl);
    const pages = await client.getChapterPages(chapterId, sourceId);
    return NextResponse.json({ pages });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}