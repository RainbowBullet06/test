// Estructura del formato "EVALUACIÓN DE COMUNICACIÓN VERBAL" (Nivel de Educación Especial Estatal)

export const ORGANOS = [
  'Lengua', 'Frenillo lingual', 'Labios', 'Mandíbula', 'Mejillas', 'Dientes',
  'Paladar duro', 'Velo de paladar', 'Úvula', 'Anginas', 'Nariz',
] as const

export const RESPIRACION = [
  {
    id: 'clavicular', nombre: 'Clavicular',
    desc: 'Aprovecha la parte superior de los pulmones, levantando los hombros y las clavículas al respirar.',
  },
  {
    id: 'intercostal', nombre: 'Intercostal',
    desc: 'Torácica intermedia: dilata el tórax y ensancha las costillas, con descenso parcial del diafragma.',
  },
  {
    id: 'costoabdominal', nombre: 'Costo-abdominal',
    desc: 'Diafragmática: el diafragma desciende al máximo, con aumento del volumen del abdomen y del diámetro torácico.',
  },
] as const

export const VOZ = [
  { id: 'intensidad', nombre: 'Intensidad (volumen)', opciones: ['Alto', 'Medio', 'Bajo'] },
  { id: 'timbre', nombre: 'Timbre', opciones: ['Normal', 'Nasal', 'Gutural'] },
  { id: 'ritmo', nombre: 'Ritmo', opciones: ['Lento', 'Normal', 'Rápido'] },
  { id: 'tono', nombre: 'Tono', opciones: ['Grave', 'Central', 'Agudo'] },
] as const

export const AUDITIVA = [
  { id: 'bilateral', texto: 'El alumno tiene escucha bilateral' },
  { id: 'procedencia', texto: 'Discrimina de dónde procede el sonido' },
  { id: 'onomatopeyas', texto: 'Discrimina sonidos de onomatopeyas' },
  { id: 'sonoridad', texto: 'Discrimina la sonoridad de los fonemas' },
] as const

export const ORACIONES = ['Simples', 'Complejas'] as const

export const ELEMENTOS = [
  'Artículo', 'Sustantivo', 'Adjetivo', 'Verbo', 'Conjunciones', 'Preposiciones',
  'Pronombres', 'Adverbios', 'Género', 'Número', 'Tiempos verbales',
] as const

export interface IndicadorSemantico {
  id: string
  // texto con huecos "___" que se llenan con los objetos elegidos
  pregunta: string
  huecos: number
  ayuda?: string
}

export const SEMANTICO: IndicadorSemantico[] = [
  { id: 'queves', pregunta: '¿Qué ves aquí?', huecos: 0 },
  { id: 'parece', pregunta: '¿En qué se parece un ___ a un ___?', huecos: 2 },
  { id: 'diferentes', pregunta: '¿Por qué son diferentes un ___ de un ___?', huecos: 2 },
  { id: 'sirve', pregunta: '¿Para qué sirve un(a) ___?', huecos: 1 },
  { id: 'donde', pregunta: '¿En dónde se utiliza un ___?', huecos: 1 },
  {
    id: 'adivinanza', pregunta: 'Estructure una adivinanza', huecos: 0,
    ayuda: 'Ejemplo: "Es un medio de comunicación que tiene muchos números, sirve para hacer llamadas."',
  },
]

export interface Fonema {
  n: number
  fonema: string
  palabra: string
  grupo: 'Fonemas' | 'Sinfones' | 'Diptongos'
}

const F = (n: number, fonema: string, palabra: string, grupo: Fonema['grupo'] = 'Fonemas'): Fonema => ({ n, fonema, palabra, grupo })

export const FONEMAS: Fonema[] = [
  F(1, 'm', 'Mesa'), F(2, 'm', 'Cama'),
  F(3, 'n', 'Nariz'), F(4, 'n', 'Mano'), F(5, 'n', 'Botón'),
  F(6, 'ñ', 'Piñata'),
  F(7, 'p', 'Pelota'), F(8, 'p', 'Mariposa'),
  F(9, 'x', 'Jabón'), F(10, 'x', 'Ojo'), F(11, 'x', 'Reloj'),
  F(12, 'b', 'Balón'), F(13, 'b', 'Bebé'),
  F(14, 'k', 'Casa'), F(15, 'k', 'Boca'),
  F(16, 'g', 'Gato'), F(17, 'g', 'Tortuga'),
  F(18, 'f', 'Foco'), F(19, 'f', 'Elefante'),
  F(20, 'y', 'Llave'), F(21, 'y', 'Payaso'),
  F(22, 'd', 'Dedo'), F(23, 'd', 'Candado'), F(24, 'd', 'Red'),
  F(25, 'l', 'Luna'), F(26, 'l', 'Pelota'), F(27, 'l', 'Sol'),
  F(28, 'r', 'Arete'), F(29, 'r', 'Collar'),
  F(30, 'rr', 'Rata'), F(31, 'rr', 'Perro'),
  F(32, 't', 'Teléfono'), F(33, 't', 'Patín'),
  F(34, 'ch', 'Chupón'), F(35, 'ch', 'Cuchara'),
  F(36, 's', 'Silla'), F(37, 's', 'Refresco'), F(38, 's', 'Lápiz'),
  F(39, 'bl', 'Blusa', 'Sinfones'), F(40, 'kl', 'Clavos', 'Sinfones'), F(41, 'fl', 'Flor', 'Sinfones'),
  F(42, 'gl', 'Globo', 'Sinfones'), F(43, 'pl', 'Plato', 'Sinfones'), F(44, 'br', 'Libro', 'Sinfones'),
  F(45, 'kr', 'Cruz', 'Sinfones'), F(46, 'dr', 'Cocodrilo', 'Sinfones'), F(47, 'fr', 'Fresas', 'Sinfones'),
  F(48, 'gr', 'Tigre', 'Sinfones'), F(49, 'pr', 'Príncipe', 'Sinfones'), F(50, 'tr', 'Tren', 'Sinfones'),
  F(51, 'au', 'Jaula', 'Diptongos'), F(52, 'ei', 'Peine', 'Diptongos'), F(53, 'ua', 'Guante', 'Diptongos'),
  F(54, 'ie', 'Pie', 'Diptongos'), F(55, 'ue', 'Huevo', 'Diptongos'),
]

// Referentes para el análisis e informe de los factores fonológicos
export const PUNTO_ARTICULACION = [
  { nombre: 'Bilabial', fonemas: ['b', 'p', 'm'] },
  { nombre: 'Dental', fonemas: ['d', 't'] },
  { nombre: 'Labio-dental', fonemas: ['f'] },
  { nombre: 'Alveolar', fonemas: ['s', 'l', 'n', 'r', 'rr'] },
  { nombre: 'Velar', fonemas: ['k', 'g', 'x'] },
  { nombre: 'Palatal', fonemas: ['y', 'ch', 'ñ'] },
]

export const MODO_ARTICULACION = [
  { nombre: 'Oclusiva', fonemas: ['p', 't', 'k', 'b', 'd', 'g'], desc: 'Cierre total y momentáneo del canal bucal; al deshacerse, el sonido se precipita en una breve explosión.' },
  { nombre: 'Nasal', fonemas: ['m', 'n', 'ñ'], desc: 'Clase especial de oclusivas con resonancia nasal.' },
  { nombre: 'Fricativa (vibrante)', fonemas: ['f', 'rr', 's', 'y', 'ch', 'x'], desc: 'Cierre incompleto del canal bucal; el aire sale por una estrechez produciendo frotamiento prolongado.' },
  { nombre: 'Líquida', fonemas: ['l', 'r'], desc: 'Fricativas muy abiertas que se funden con otras consonantes (prisa, trazo, clima, blanco, drama, grito, flema).' },
]

export const EDADES_FONEMAS = [
  { edad: '3 a 3.5', desde: 3, sonidos: ['m', 'ñ', 'k', 't', 'x', 'p', 'n', 'l', 'f', 'y', 'ch', 'ua', 'ue'] },
  { edad: '4 a 4.5', desde: 4, sonidos: ['r', 'b', 'g', 'pl', 'bl', 'ie'] },
  { edad: '5 a 5.5', desde: 5, sonidos: ['kl', 'br', 'fl', 'kr', 'au', 'ei'] },
  { edad: '6 a 6.5', desde: 6, sonidos: ['d', 's', 'r', 'rr', 'pr', 'gl', 'fr', 'tr', 'dr', 'eo'] },
]

export function edadEsperada(fonema: string): number | null {
  const g = EDADES_FONEMAS.find((e) => e.sonidos.includes(fonema))
  return g ? g.desde : null
}

// Secciones del informe final (mismo orden que el formato .docx)
export const SECCIONES_INFORME = [
  {
    id: 'fonoarticulador', titulo: 'Aparato fonoarticulador',
    guia: 'Estado anatómico y funcional del aparato fonoarticulador y tipo de respiración.',
    ejemplo: 'En exploración de aparato fonoarticulador la alumna no tiene dificultad en movimiento funcional de órganos, su respiración es normal.',
  },
  {
    id: 'pragmatico', titulo: 'Componente pragmático (Uso)',
    guia: 'Coherencia lineal o global; diálogo espontáneo o dirigido; inicio, desarrollo y final de una historia; respeta turnos; cambios de entonación; lenguaje no verbal.',
    ejemplo: 'En la narración y descripción de una imagen menciona sustantivos y verbos. No toma en cuenta el inicio, desarrollo y final, respeta turno para participar, su diálogo es dirigido con coherencia lineal.',
  },
  {
    id: 'semantico', titulo: 'Componente semántico (Contenido)',
    guia: 'Comprensión del significado de palabras y de conceptos abstractos.',
    ejemplo: 'Comprende órdenes sencillas, sus conceptos son iniciales de uso y características, da respuesta a las adivinanzas, tiene dificultad para establecer semejanzas y diferencias de objetos comunes.',
  },
  {
    id: 'morfosintactico', titulo: 'Componente morfosintáctico (Forma)',
    guia: 'Estructura gramatical en la conformación de enunciados y frases.',
    ejemplo: 'En la estructura gramatical utiliza sustantivo y verbo.',
  },
  {
    id: 'fonologico', titulo: 'Componente fonológico (Forma)',
    guia: 'Alteraciones fonológicas por punto y modo de articulación.',
    ejemplo: 'No presenta trastornos fonológicos de punto y modo de articulación.',
  },
  {
    id: 'suprasegmentos', titulo: 'Suprasegmentos de voz',
    guia: 'Volumen, timbre, ritmo y tono.',
    ejemplo: 'En suprasegmentos de voz tiene volumen bajo, timbre normal, ritmo lento, tono grave.',
  },
  {
    id: 'conclusion', titulo: 'Condición comunicativa (conclusión)',
    guia: 'Condición comunicativa en lo expresivo y/o comprensivo; si es necesario, derivación a equipo multidisciplinario para atención clínica.',
    ejemplo: 'La alumna presenta dificultad en lenguaje comprensivo y expresivo. En el componente pragmático para dialogar e interactuar. En el componente semántico se le dificulta comprender cuestionamientos, semejanzas y diferencias.',
  },
] as const

export type SeccionId = (typeof SECCIONES_INFORME)[number]['id']
