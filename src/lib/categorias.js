// Classifica o "pedido" de cada pet numa categoria de presente,
// para alimentar os filtros da galeria. Baseado em palavras-chave.

export const CATEGORIAS = {
  cama: { label: 'Casinha & Cama' },
  conforto: { label: 'Cobertor & Conforto' },
  brinquedo: { label: 'Brinquedo' },
  petisco: { label: 'Petisco & Comida' },
  outros: { label: 'Outros mimos' },
};

const REGRAS = [
  // a ordem importa: a primeira palavra encontrada define a categoria
  { cat: 'brinquedo', termos: ['brinquedo', 'bolinha', 'pelúcia', 'pelucia', 'ursinho', 'mordedor', 'lançador', 'lancador', 'kit de brinquedos'] },
  { cat: 'petisco', termos: ['petisco', 'sachê', 'sache', 'ração', 'racao', 'guloseima', 'osso', 'orelha', 'biscoito', 'snack', 'comida', 'gulodice'] },
  { cat: 'cama', termos: ['casinha', 'caminha', 'cama', 'colchão', 'colchao', 'pneu', 'suspensa', 'almofada', 'almofadinha'] },
  { cat: 'conforto', termos: ['cobertor', 'manta', 'mantinha', 'tapete', 'eva', 'chafariz', 'bebedouro', 'fonte', 'arranhador', 'caixa de areia'] },
];

export function categorizar(pedido = '') {
  const p = pedido.toLowerCase();
  for (const { cat, termos } of REGRAS) {
    if (termos.some((t) => p.includes(t))) return cat;
  }
  return 'outros';
}
