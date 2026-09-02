export function obterDuracaoVideo(arquivo: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (!arquivo.type.startsWith('video/') || typeof document === 'undefined') return resolve(null);
    const video = document.createElement('video');
    const url = URL.createObjectURL(arquivo);
    const encerrar = (valor: number | null) => { URL.revokeObjectURL(url); resolve(valor); };
    video.preload = 'metadata';
    video.onloadedmetadata = () => encerrar(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    video.onerror = () => encerrar(null);
    video.src = url;
  });
}
