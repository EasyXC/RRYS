import { NextRequest, NextResponse } from 'next/server';

import { keiyouMangaClient, KeiyouMangaClient } from '@/lib/keiyou-manga.client';
import { suwayomiClient } from '@/lib/suwayomi.client';

import { getAuthorizedUsername } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const repoUrl = new URL(request.url).searchParams.get('repo') || undefined;
    const defaultLang = new URL(request.url).searchParams.get('lang') || 'zh';

    // 如果没有 Suwayomi，或者请求来自内置源，直接返回 keiyou 源
    try {
      const suwayomiSources = await suwayomiClient.getSources(defaultLang);
      if (suwayomiSources.length > 0) {
        return NextResponse.json({ sources: suwayomiSources });
      }
    } catch {
      // Suwayomi 未配置或连接失败，fallback 到内置源
    }

    // 返回内置源
    const client = repoUrl ? new KeiyouMangaClient(repoUrl) : keiyouMangaClient;
    const sources = await client.getSources();
    return NextResponse.json({ sources });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}