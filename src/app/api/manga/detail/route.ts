import { NextRequest, NextResponse } from 'next/server';

import { keiyouMangaClient, KeiyouMangaClient } from '@/lib/keiyou-manga.client';
import { suwayomiClient } from '@/lib/suwayomi.client';

import { getAuthorizedUsername } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const mangaId = searchParams.get('mangaId')?.trim();
    const sourceId = searchParams.get('sourceId')?.trim();
    const repoUrl = searchParams.get('repo') || undefined;

    if (!mangaId || !sourceId) {
      return NextResponse.json({ error: '缺少 mangaId 或 sourceId' }, { status: 400 });
    }

    // 自动路由：keiyou: 前缀走内置源，否则走 Suwayomi
    if (sourceId.startsWith('keiyou:')) {
      const client = repoUrl ? new KeiyouMangaClient(repoUrl) : keiyouMangaClient;
      const detail = await client.getMangaDetail(mangaId, sourceId);
      if (!detail) {
        return NextResponse.json({ error: '未找到漫画或请求失败' }, { status: 404 });
      }
      return NextResponse.json(detail);
    }

    const detail = await suwayomiClient.getMangaDetail({
      mangaId,
      sourceId,
      title: searchParams.get('title') || undefined,
      cover: searchParams.get('cover') || undefined,
      sourceName: searchParams.get('sourceName') || undefined,
      description: searchParams.get('description') || undefined,
      author: searchParams.get('author') || undefined,
      status: searchParams.get('status') || undefined,
    });

    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}