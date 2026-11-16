/**
 * Покадровая анимация только пока элемент на экране: за пределами вьюпорта кадры не считаются
 * (фоновые canvas-анимации не тратят батарею, когда их прокрутили). Скрытую вкладку браузер и так останавливает.
 * Возвращает функцию остановки.
 */
export function animateWhileVisible(el: Element, frame: (ms: number) => void): () => void {
  let raf = 0;
  let running = false;
  const loop = (ms: number) => {
    frame(ms);
    raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) {
      running = true;
      raf = requestAnimationFrame(loop);
    } else if (!e.isIntersecting && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  });
  io.observe(el);
  return () => {
    io.disconnect();
    cancelAnimationFrame(raf);
  };
}
