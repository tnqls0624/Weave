import { useCallback, useRef } from "react";

interface DoubleTapOptions {
  delay?: number;
  onSingleTap?: () => void;
  onDoubleTap?: () => void;
}

export const useDoubleTap = (options: DoubleTapOptions) => {
  const { delay = 500, onSingleTap, onDoubleTap } = options;
  const lastTapRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const handlePress = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    // 더블탭 판정 (500ms 이내에 두 번째 탭)
    if (timeSinceLastTap < delay && lastTapRef.current > 0) {
      // 더블탭 감지!
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      lastTapRef.current = 0; // 리셋

      // 더블탭만 실행 (디테일 열기)
      if (onDoubleTap) {
        onDoubleTap();
      }
    } else {
      // 첫 번째 탭 - 즉시 싱글탭 실행
      lastTapRef.current = now;

      // 싱글탭 즉시 실행
      if (onSingleTap) {
        onSingleTap();
      }

      // delay 시간 내에 두 번째 탭이 오지 않으면 타이머 리셋
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        lastTapRef.current = 0;
        timerRef.current = null;
      }, delay);
    }
  }, [delay, onSingleTap, onDoubleTap]);

  return { handlePress };
};
