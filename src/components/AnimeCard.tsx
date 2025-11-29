// src/components/AnimeCard.tsx

export default function AnimeCard(
  {
    cover,
    title,
    meta,
    children,
    variant = 'compact',
  }: {
    cover?: string;
    title: string;
    meta?: string;
    children?: React.ReactNode;
    /** 
     * compact  = style fin (comme avant) pour Propositions / Validés
     * stacked  = zone actions en colonne à droite (pour l'aside "Liste principale")
     */
    variant?: 'compact' | 'stacked';
  }
) {
  if (variant === 'stacked') {
    // ------- Variante "stacked": actions en colonne à droite, stable pour l'aside -------
    return (
      <div className="flex items-stretch gap-3 border rounded-2xl p-3">
        {/* Cover */}
        {cover && (
          <img
            src={cover}
            className="w-12 h-16 object-cover rounded-xl flex-shrink-0"
            alt="cover"
          />
        )}

        {/* Titre + meta (gauche) */}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{title}</div>
          {meta && <div className="text-xs opacity-70 line-clamp-2">{meta}</div>}
        </div>

        {/* Zone droite: texte + boutons empilés */}
        {children && (
          <div className="flex flex-col items-end gap-2 flex-shrink-0 text-right">
            {children}
          </div>
        )}
      </div>
    )
  }

  // ------- Variante "compact": rangée serrée (comme ta version d'origine) -------
  return (
    <div className="flex gap-3 items-center border rounded-2xl p-3">
      {cover && (
        <img
          src={cover}
          className="w-12 h-16 object-cover rounded-xl flex-shrink-0"
          alt="cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{title}</div>
        {meta && <div className="text-xs opacity-70">{meta}</div>}
      </div>
      {/* actions à droite (wrap si besoin, mais plus compact) */}
      {children && (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {children}
        </div>
      )}
    </div>
  )
}
