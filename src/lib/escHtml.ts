/**
 * Échappe les caractères HTML spéciaux pour éviter XSS dans les emails et templates HTML.
 * Utilisé partout où du contenu utilisateur est injecté dans du HTML.
 */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
