// Funciones que expone electron/preload.cjs. Solo existen en la app de escritorio.
interface EscritorioAPI {
  respaldo: {
    carpeta(): Promise<string | null>
    sugerida(): Promise<string>
    usar(carpeta: string): Promise<string>
    elegir(): Promise<string | null>
    escribir(rel: string, datos: string | Uint8Array): Promise<boolean>
    leer(rel: string): Promise<string | null>
    rotar(rel: string, conservar: number): Promise<number>
    abrir(): Promise<void>
  }
  sync: {
    iniciar(origenes: string[]): Promise<{ token: string; puerto: number; ips: string[]; vence: number }>
    detener(): Promise<void>
    responder(r: { id: string; paquete?: string; error?: string }): Promise<void>
    alSolicitar(fn: (d: { id: string; paquete: { cuerpo: string; comprimido: boolean } }) => void): () => void
    alEvento(fn: (d: { evento: 'recibiendo' | 'error' | 'vence' | 'detenido'; mensaje?: string; vence?: number }) => void): () => void
  }
}

interface Window {
  escritorio?: EscritorioAPI
}
declare const __APP_VERSION__: string
