# Paquete local de Diktat Player

Este branch genera una variante que se abre directamente desde `index.html` mediante `file://`.

## Crear el paquete

```bash
npm install
npm run package:local
```

La salida se crea en `dist/local-package/Diktat-Player`.

## Diferencias técnicas

- No registra Service Worker cuando se ejecuta mediante `file://`.
- Empaqueta los módulos de Piper en un único script clásico, porque los módulos ES locales están bloqueados por los navegadores.
- Convierte los binarios WASM y los datos del fonemizador en recursos internos `blob:`.
- Guarda TXT y WAV mediante descargas `blob:` sin depender de Cache Storage.
- Mantiene el funcionamiento HTTPS original sin modificaciones en la aplicación publicada.
- La primera versión local no incluye transcripción Whisper. Los modelos de voz de Piper se descargan la primera vez y requieren Internet.

El ZIP de prueba se genera desde esta salida; no debe confundirse con la PWA publicada en GitHub Pages.
