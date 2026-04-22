'use client';

import { useEffect, useRef, useState } from 'react';

interface AdUnlockModalProps {
  onUnlocked: () => void;
}

export default function AdUnlockModal({ onUnlocked }: AdUnlockModalProps) {
  const [phase, setPhase] = useState<'ad' | 'thanks'>('ad');
  const [countdown, setCountdown] = useState(5);
  const [canClose, setCanClose] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const config = (window as any).RUNTIME_CONFIG;
    const seconds = config?.AD_UNLOCK_COUNTDOWN_SECONDS ?? 5;
    setCountdown(seconds);
  }, []);

  useEffect(() => {
    if (phase !== 'ad') return;
    const config = (window as any).RUNTIME_CONFIG;
    const seconds = config?.AD_UNLOCK_COUNTDOWN_SECONDS ?? 5;

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const handleComplete = () => {
    setPhase('thanks');
    setCanClose(true);
    localStorage.setItem('ad_unlock', JSON.stringify({
      timestamp: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }));
    onUnlocked();
    // 3秒后自动关闭感谢界面
    setTimeout(() => {
      const backdrop = document.getElementById('ad-unlock-backdrop');
      if (backdrop) backdrop.remove();
    }, 3000);
  };

  const handleClose = () => {
    if (!canClose) return;
    const backdrop = document.getElementById('ad-unlock-backdrop');
    if (backdrop) backdrop.remove();
  };

  const config = (window as any).RUNTIME_CONFIG;
  const adUrl = config?.AD_UNLOCK_AD_URL || '';

  return (
    <div
      id='ad-unlock-backdrop'
      className='fixed inset-0 z-[9999] flex items-center justify-center'
      style={{ backgroundColor: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
    >
      <div className='relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl border border-gray-700' style={{ background: '#1a1a2e' }}>

        {/* 顶部提示条 */}
        <div style={{ background: 'linear-gradient(90deg, #f97316, #ef4444)' }} className='px-5 py-3 text-center'>
          <p className='text-white text-sm font-medium'>
            🎬 观看下方广告，即可在 24 小时内免费浏览全站所有内容
          </p>
        </div>

        {phase === 'ad' && (
          <>
            {/* 广告内容区 */}
            <div className='relative bg-black' style={{ height: '300px' }}>
              {adUrl ? (
                <iframe
                  src={adUrl}
                  className='w-full h-full'
                  style={{ border: 'none' }}
                  sandbox='allow-scripts allow-same-origin allow-forms'
                />
              ) : (
                /* 默认模拟广告占位 */
                <div className='w-full h-full flex flex-col items-center justify-center' style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }}>
                  <div className='text-6xl mb-4'>🎁</div>
                  <h3 className='text-xl font-bold text-white mb-2'>限时免费解锁</h3>
                  <p className='text-gray-400 text-sm mb-1'>观看广告 → 免费畅享全站 24 小时</p>
                  <p className='text-gray-500 text-xs mt-4'>广告加载中，请稍候...</p>
                  {/* 广告标识（合规） */}
                  <div className='absolute bottom-2 right-3 text-xs text-gray-600'>广告</div>
                </div>
              )}
            </div>

            {/* 底部操作区 */}
            <div className='px-6 py-5 flex items-center justify-between' style={{ background: '#0f0f23' }}>
              <div className='flex items-center gap-3'>
                <div className='w-14 h-14 rounded-full border-4 flex items-center justify-center' style={{ borderColor: '#f97316' }}>
                  <span className='text-white font-bold text-xl'>{countdown}</span>
                </div>
                <div>
                  <p className='text-gray-500 text-xs'>广告倒计时</p>
                  <p className='text-white text-sm font-medium'>秒后自动解锁</p>
                </div>
              </div>
              <div className='text-right'>
                <p className='text-gray-500 text-xs mb-1'>解锁后</p>
                <p className='text-orange-400 text-sm font-bold'>24 小时全站免费</p>
              </div>
            </div>

            {/* 进度条 */}
            <div className='h-1 w-full' style={{ background: '#1a1a2e' }}>
              <div
                className='h-full transition-all duration-1000 ease-linear'
                style={{ background: 'linear-gradient(90deg, #f97316, #ef4444)', width: `${((5 - countdown) / 5) * 100}%` }}
              />
            </div>
          </>
        )}

        {phase === 'thanks' && (
          <div className='flex flex-col items-center justify-center py-16 px-8' style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', minHeight: '380px' }}>
            <div className='text-7xl mb-6'>🎉</div>
            <h2 className='text-2xl font-bold text-white mb-3'>感谢您的支持</h2>
            <p className='text-gray-400 text-sm mb-1'>全站内容已为您免费开放</p>
            <p className='text-orange-400 text-sm font-medium mb-8'>24 小时内可免费浏览所有内容</p>
            <div className='px-8 py-3 rounded-full border' style={{ borderColor: '#f97316', background: 'rgba(249,115,22,0.1)' }}>
              <p className='text-orange-300 text-sm'>✨ 解锁成功，尽情享用吧！</p>
            </div>
            {canClose && (
              <button onClick={handleClose} className='mt-6 text-gray-500 hover:text-white text-sm transition-colors'>
                [ 关闭 ]
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
