import { NextRequest, NextResponse } from 'next/server';

import { KeiyouMangaClient } from '@/lib/keiyou-manga.client';

import { getAuthorizedUsername } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const mangaId = searchParams.get('mangaId')?.trim();
    const sourceId = searchParams.get('sourceId')?.trim();
    const repoUrl = searchParams.get('repo') ||
      'https://gh-proxy.com/https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json';

    if (!mangaId || !sourceId) {
      return NextResponse.json({ error: '缺少 mangaId 或 sourceId' }, { status: 400 });
    }

    const client = new KeiyouMangaClient(repoUrl);
    const detail = await client.getMangaDetail(mangaId, sourceId);

    if (!detail) {
      return NextResponse.json({ error: '未找到漫画或请求失败' }, { status: 404 });
    }

    return NextResponse.json({ detail });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}